import { Router } from 'express'
import { google } from 'googleapis'
import { z } from 'zod'
import { Readable } from 'node:stream'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { ZipArchive } from 'archiver'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { publicTokenLimiter } from '../../middleware/rate-limit.middleware.js'
import { decryptText, encryptText, hashToken, randomToken } from '../../utils/crypto.js'
import { hashPassword } from '../../utils/password.js'
import { createAuditLog } from '../../utils/audit.js'
import { chunk } from '../../utils/db.js'
import {
  getAuthedGoogleClient,
  syncGoogleAppFolderFiles,
  syncGoogleQuota,
} from '../google/google.service.js'
import {
  createS3Client,
  deleteS3Object,
  getS3ConfigForAccount,
  syncS3Quota,
} from '../s3/s3.service.js'
import { streamProviderFile } from './stream-file.js'
import { contentDisposition } from './stream-security.js'
import {
  googleDownloadExportMimeTypes,
  normalizeHeaders,
  withExtension,
} from './stream-google-file.js'
import {
  buildFileWhere,
  fileFilterSchema,
  fileInclude,
  fileOrderBy,
  paginationSchema,
  serializeFile,
} from './file.query.js'

export const fileRouter = Router()

/**
 * Short-lived preview tokens. Public by design so an <img> or <video> element
 * can load the bytes without an Authorization header, which is why it sits
 * above `requireAuth` and carries its own rate limit.
 */
fileRouter.get('/preview/:token', publicTokenLimiter, async (req, res, next) => {
  try {
    const preview = await prisma.filePreviewToken.findFirst({
      where: { tokenHash: hashToken(String(req.params.token)), expiresAt: { gt: new Date() } },
      include: { file: { include: { connectedAccount: true } } },
    })
    if (!preview || preview.file.status !== 'active') {
      throw HttpError.notFound('Preview token not found or expired.', 'PREVIEW_NOT_FOUND')
    }
    return await streamProviderFile(preview.file, req.headers.range, res, { disposition: 'inline' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.use(requireAuth)

/** Paginated file list. Also powers search, since the filters are the same. */
fileRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const filter = fileFilterSchema.parse(req.query)
    const page = paginationSchema.parse(req.query)

    // Fetch one extra row to detect a further page without a COUNT query.
    const rows = await prisma.file.findMany({
      where: buildFileWhere(req.user!.id, filter, 'active'),
      include: fileInclude,
      orderBy: fileOrderBy(page.sort, page.direction),
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    })

    const files = rows.slice(0, page.limit)
    return res.json({
      files: files.map(serializeFile),
      nextCursor: rows.length > page.limit ? files.at(-1)?.id : null,
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * Totals for the current filter.
 *
 * Separate from the list so the list stays a single cheap indexed query and
 * the UI can show "1,284 files · 42.1 GB" without loading every row.
 */
fileRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const filter = fileFilterSchema.parse(req.query)
    const where = buildFileWhere(req.user!.id, filter, 'active')
    const [aggregate, starred] = await Promise.all([
      prisma.file.aggregate({ where, _count: { _all: true }, _sum: { sizeBytes: true } }),
      prisma.file.count({ where: { ...where, starred: true } }),
    ])
    return res.json({
      count: aggregate._count._all,
      sizeBytes: (aggregate._sum.sizeBytes ?? 0n).toString(),
      starred,
    })
  } catch (error) {
    return next(error)
  }
})

/** Recently touched files, grouped client-side into Today / This week / Earlier. */
fileRouter.get('/recent', async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query)
    const files = await prisma.file.findMany({
      where: { userId: req.user!.id, status: 'active' },
      include: fileInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    })
    return res.json({ files: files.map(serializeFile) })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/starred', async (req: AuthRequest, res, next) => {
  try {
    const page = paginationSchema.parse(req.query)
    const rows = await prisma.file.findMany({
      where: { userId: req.user!.id, status: 'active', starred: true },
      include: fileInclude,
      orderBy: [{ starredAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    })
    const files = rows.slice(0, page.limit)
    return res.json({
      files: files.map(serializeFile),
      nextCursor: rows.length > page.limit ? files.at(-1)?.id : null,
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * Files that share a checksum with another file.
 *
 * Grouped in the database rather than by loading every row: a user with
 * 50,000 files should not have to download them to find duplicates.
 * Google supplies MD5 on sync; uploads compute SHA-256 as they stream.
 */
fileRouter.get('/duplicates', async (req: AuthRequest, res, next) => {
  try {
    const groups = await prisma.file.groupBy({
      by: ['checksum'],
      where: { userId: req.user!.id, status: 'active', checksum: { not: null } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
      having: { checksum: { _count: { gt: 1 } } },
      orderBy: { _sum: { sizeBytes: 'desc' } },
      take: 100,
    })

    const checksums = groups.map((group) => group.checksum).filter((v): v is string => v !== null)
    const files =
      checksums.length === 0
        ? []
        : await prisma.file.findMany({
            where: { userId: req.user!.id, status: 'active', checksum: { in: checksums } },
            include: fileInclude,
            orderBy: [{ checksum: 'asc' }, { createdAt: 'asc' }],
          })

    const byChecksum = new Map<string, ReturnType<typeof serializeFile>[]>()
    for (const file of files) {
      if (!file.checksum) continue
      const list = byChecksum.get(file.checksum) ?? []
      list.push(serializeFile(file))
      byChecksum.set(file.checksum, list)
    }

    return res.json({
      groups: groups.map((group) => {
        const members = byChecksum.get(group.checksum!) ?? []
        const total = group._sum.sizeBytes ?? 0n
        const unit = members.length > 0 ? BigInt(members[0].sizeBytes) : 0n
        return {
          checksum: group.checksum,
          count: group._count._all,
          totalBytes: total.toString(),
          // What deleting every copy but one would free.
          reclaimableBytes: (total - unit).toString(),
          files: members,
        }
      }),
    })
  } catch (error) {
    return next(error)
  }
})

const cleanupDuplicatesSchema = z.object({
  keep: z.enum(['oldest', 'newest']).default('oldest'),
  dryRun: z.boolean().default(true),
})

fileRouter.post('/duplicates/cleanup', async (req: AuthRequest, res, next) => {
  try {
    const { keep, dryRun } = cleanupDuplicatesSchema.parse(req.body ?? {})

    const groups = await prisma.file.groupBy({
      by: ['checksum'],
      where: { userId: req.user!.id, status: 'active', checksum: { not: null } },
      _count: { _all: true },
      having: { checksum: { _count: { gt: 1 } } },
    })

    const checksums = groups.map((g) => g.checksum).filter((v): v is string => v !== null)
    if (checksums.length === 0) {
      return res.json({ deleted: 0, freedBytes: '0', files: [], dryRun, success: true })
    }

    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: { userId: req.user!.id, status: 'active', checksum: { in: checksums } },
        orderBy: [{ checksum: 'asc' }, { createdAt: keep === 'oldest' ? 'asc' : 'desc' }],
      }),
      prisma.folder.findMany({
        where: { userId: req.user!.id, deletedAt: null },
        select: { id: true, name: true, parentId: true },
      }),
    ])

    const foldersById = new Map(folders.map((f) => [f.id, f]))
    function buildPath(folderId: string | null | undefined, name: string): string {
      if (!folderId) return `/${name}`
      const parts = [name]
      let cur = foldersById.get(folderId)
      const visited = new Set<string>()
      while (cur && !visited.has(cur.id)) {
        visited.add(cur.id)
        parts.unshift(cur.name)
        cur = cur.parentId ? foldersById.get(cur.parentId) : undefined
      }
      return `/${parts.join('/')}`
    }

    const byChecksum = new Map<string, typeof files>()
    for (const f of files) {
      if (!f.checksum) continue
      const list = byChecksum.get(f.checksum) ?? []
      list.push(f)
      byChecksum.set(f.checksum, list)
    }

    const itemsToRemove: Array<{
      id: string
      name: string
      path: string
      size: string
      checksum: string
      dedupedAgainstFileId: string
    }> = []
    let freedBytes = 0n

    for (const [, list] of byChecksum.entries()) {
      if (list.length <= 1) continue
      const original = list[0]
      const duplicates = list.slice(1)
      for (const dup of duplicates) {
        itemsToRemove.push({
          id: dup.id,
          name: dup.name,
          path: buildPath(dup.folderId, dup.name),
          size: dup.sizeBytes.toString(),
          checksum: dup.checksum ?? '',
          dedupedAgainstFileId: original.id,
        })
        freedBytes += dup.sizeBytes
      }
    }

    if (itemsToRemove.length === 0) {
      return res.json({ deleted: 0, freedBytes: '0', files: [], dryRun, success: true })
    }

    if (dryRun) {
      return res.json({
        deleted: itemsToRemove.length,
        freedBytes: freedBytes.toString(),
        files: itemsToRemove,
        dryRun: true,
        success: true,
      })
    }

    // Execute: move files to trash (never permanent provider delete)
    const fileIds = itemsToRemove.map((item) => item.id)
    await prisma.file.updateMany({
      where: { id: { in: fileIds }, userId: req.user!.id },
      data: { status: 'deleted', deletedAt: new Date() },
    })

    const nowIso = new Date().toISOString()
    for (const item of itemsToRemove) {
      await createAuditLog(req.user!.id, 'file.duplicate_cleaned', 'file', item.id, {
        fileId: item.id,
        name: item.name,
        path: item.path,
        size: item.size,
        checksum: item.checksum,
        dedupedAgainstFileId: item.dedupedAgainstFileId,
        actorUserId: req.user!.id,
        timestamp: nowIso,
      })
    }

    return res.json({
      deleted: itemsToRemove.length,
      freedBytes: freedBytes.toString(),
      files: itemsToRemove,
      dryRun: false,
      success: true,
    })
  } catch (error) {
    return next(error)
  }
})

const batchFileSchema = z.object({ fileIds: z.array(z.string().uuid()).min(1).max(200) })

fileRouter.patch('/batch', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema
      .extend({ folderId: z.string().uuid().nullable().optional() })
      .parse(req.body)

    if (body.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: body.folderId, userId: req.user!.id, deletedAt: null },
        select: { id: true },
      })
      if (!folder) throw HttpError.notFound('Destination folder not found.')
    }

    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      data: { folderId: body.folderId ?? null },
    })
    await createAuditLog(req.user!.id, 'file.moved', 'file', undefined, {
      count: result.count,
      folderId: body.folderId ?? null,
      ip: req.ip,
    })
    return res.json({ status: 'ok', moved: result.count })
  } catch (error) {
    return next(error)
  }
})

/** Star or unstar many files at once, so bulk selection can use it too. */
fileRouter.patch('/batch/star', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.extend({ starred: z.boolean() }).parse(req.body)
    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      data: { starred: body.starred, starredAt: body.starred ? new Date() : null },
    })
    return res.json({ status: 'ok', updated: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/batch', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      data: { status: 'deleted', deletedAt: new Date() },
    })
    // One entry for the batch rather than one per file: the upstream version
    // wrote N rows sequentially, which made trashing a selection slow.
    await createAuditLog(req.user!.id, 'file.trashed', 'file', undefined, {
      count: result.count,
      fileIds: body.fileIds.slice(0, 50),
      ip: req.ip,
    })
    return res.json({ status: 'ok', deleted: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/trash', async (req: AuthRequest, res, next) => {
  try {
    const filter = fileFilterSchema.parse(req.query)
    const page = paginationSchema.parse(req.query)
    const rows = await prisma.file.findMany({
      where: buildFileWhere(req.user!.id, filter, 'deleted'),
      include: fileInclude,
      orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    })
    const files = rows.slice(0, page.limit)
    return res.json({
      files: files.map(serializeFile),
      nextCursor: rows.length > page.limit ? files.at(-1)?.id : null,
    })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/batch/restore', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const result = await prisma.file.updateMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'deleted' },
      data: { status: 'active', deletedAt: null },
    })
    await createAuditLog(req.user!.id, 'file.restored', 'file', undefined, {
      count: result.count,
      ip: req.ip,
    })
    return res.json({ status: 'ok', restored: result.count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/batch/permanent', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.parse(req.body)
    const files = await prisma.file.findMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'deleted' },
      include: { connectedAccount: true },
    })

    const deletedIds: string[] = []
    const failed: { fileId: string; name: string; message: string }[] = []
    const touchedAccounts = new Map<string, string>()

    for (const file of files) {
      try {
        if (file.provider === 's3') {
          await deleteS3Object(file)
        } else {
          const drive = google.drive({
            version: 'v3',
            auth: await getAuthedGoogleClient(file.connectedAccount),
          })
          await drive.files.delete({ fileId: file.providerFileId })
        }
        deletedIds.push(file.id)
        touchedAccounts.set(file.connectedAccountId, file.provider)
      } catch (error) {
        // A file already removed at the provider should still clear locally,
        // otherwise it is stuck in the trash forever.
        const message = error instanceof Error ? error.message : 'Delete failed'
        if (/not found|notFound|404|NoSuchKey/i.test(message)) {
          deletedIds.push(file.id)
          touchedAccounts.set(file.connectedAccountId, file.provider)
        } else {
          failed.push({ fileId: file.id, name: file.name, message })
        }
      }
    }

    if (deletedIds.length > 0) {
      await prisma.file.deleteMany({ where: { id: { in: deletedIds }, userId: req.user!.id } })
      await createAuditLog(req.user!.id, 'file.deleted_permanently', 'file', undefined, {
        count: deletedIds.length,
        ip: req.ip,
      })
    }

    for (const [accountId, provider] of touchedAccounts) {
      const sync = provider === 's3' ? syncS3Quota : syncGoogleQuota
      await sync(accountId).catch(() => undefined)
    }

    if (deletedIds.length === 0 && failed.length > 0) {
      return res.status(400).json({
        code: 'FILES_DELETE_FAILED',
        message: 'No files could be permanently deleted.',
        deleted: 0,
        failed,
      })
    }
    return res.json({ status: 'ok', deleted: deletedIds.length, failed })
  } catch (error) {
    return next(error)
  }
})

function shareUrl(share: { tokenEncrypted: string | null }) {
  if (!share.tokenEncrypted) return null
  try {
    return `${env.FRONTEND_URL}/public/files/${decryptText(share.tokenEncrypted)}`
  } catch {
    // Unreadable after a TOKEN_ENCRYPTION_KEY rotation. The link still works
    // for anyone holding it; we just cannot show it again.
    return null
  }
}

fileRouter.get('/shared-links', async (req: AuthRequest, res, next) => {
  try {
    const shares = await prisma.fileShare.findMany({
      where: {
        userId: req.user!.id,
        enabled: true,
        file: { status: 'active' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { file: { include: fileInclude } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return res.json({
      shares: shares.map((share) => ({
        id: share.id,
        url: shareUrl(share),
        hasPassword: Boolean(share.passwordHash),
        downloadCount: share.downloadCount,
        lastAccessedAt: share.lastAccessedAt?.toISOString() ?? null,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
        file: serializeFile(share.file),
      })),
    })
  } catch (error) {
    return next(error)
  }
})

/** Revokes every active share link in one action. */
fileRouter.post('/shared-links/revoke-all', async (req: AuthRequest, res, next) => {
  try {
    const { count } = await prisma.fileShare.updateMany({
      where: { userId: req.user!.id, enabled: true },
      data: { enabled: false },
    })
    await createAuditLog(req.user!.id, 'share.revoked_all', 'file_share', undefined, {
      count,
      ip: req.ip,
    })
    return res.json({ status: 'ok', revoked: count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/sync-google', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({ connectedAccountId: z.string().uuid().optional() })
      .parse(req.body ?? {})

    const accounts = await prisma.connectedAccount.findMany({
      where: {
        userId: req.user!.id,
        provider: 'google_drive',
        status: 'connected',
        ...(body.connectedAccountId ? { id: body.connectedAccountId } : {}),
      },
      select: { id: true, email: true },
    })

    const results = []
    const failures = []
    for (const account of accounts) {
      try {
        results.push(await syncGoogleAppFolderFiles(account.id, req.user!.id))
      } catch (error) {
        // One broken account must not abort the sync for the others.
        failures.push({
          accountId: account.id,
          email: account.email,
          message: error instanceof Error ? error.message : 'Sync failed',
        })
      }
    }

    return res.json({ status: failures.length > 0 ? 'partial' : 'ok', results, failures })
  } catch (error) {
    return next(error)
  }
})

/**
 * Streams a zip of the selected files.
 *
 * Headers are deliberately sent only after the first file resolves: once a
 * zip body has started there is no way to report an error to the client, so
 * failures that happen up front should still surface as JSON.
 */
fileRouter.post('/batch/download', async (req: AuthRequest, res, next) => {
  try {
    const body = batchFileSchema.extend({ name: z.string().trim().max(120).optional() }).parse(req.body)
    const files = await prisma.file.findMany({
      where: { id: { in: body.fileIds }, userId: req.user!.id, status: 'active' },
      include: { connectedAccount: true, folder: { select: { name: true } } },
    })
    if (files.length === 0) throw HttpError.notFound('No matching files found.', 'FILES_NOT_FOUND')

    const archiveName = `${(body.name ?? 'better-drive').replace(/[^\w.-]+/g, '-')}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', contentDisposition('attachment', archiveName))
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const archive = new ZipArchive({ zlib: { level: 6 } })
    // Throwing from this handler would take down the process, since nothing
    // is awaiting it. Destroy the response instead; the client sees a
    // truncated download, which is the honest outcome.
    archive.on('error', (error) => {
      console.error('Zip archive failed:', error)
      res.destroy()
    })
    // If the client aborts, stop pulling bytes from the storage provider.
    res.on('close', () => {
      if (!res.writableEnded) archive.abort()
    })
    archive.pipe(res)

    const usedNames = new Set<string>()
    const uniqueName = (name: string) => {
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
      // Zip entries must be unique or extraction silently drops files.
      const dot = name.lastIndexOf('.')
      const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
      let counter = 2
      let candidate = `${stem} (${counter})${ext}`
      while (usedNames.has(candidate)) candidate = `${stem} (${++counter})${ext}`
      usedNames.add(candidate)
      return candidate
    }

    for (const file of files) {
      try {
        let stream: Readable
        let entryName = file.name

        if (file.provider === 's3') {
          const config = await getS3ConfigForAccount(file.connectedAccountId)
          const response = await createS3Client(config).send(
            new GetObjectCommand({ Bucket: config.bucket, Key: file.providerFileId }),
          )
          if (!response.Body) continue
          stream = response.Body as Readable
        } else {
          const auth = await getAuthedGoogleClient(file.connectedAccount)
          const headers = normalizeHeaders(await auth.getRequestHeaders())
          const exportTarget = googleDownloadExportMimeTypes[file.mimeType]
          if (exportTarget) entryName = withExtension(file.name, exportTarget.extension)

          const url = exportTarget
            ? `https://www.googleapis.com/drive/v3/files/${file.providerFileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
            : `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`
          const response = await fetch(url, { headers })
          if (!response.ok || !response.body) continue
          stream = Readable.fromWeb(response.body as never)
        }

        // Mirror the virtual folder structure inside the archive.
        const prefix = file.folder?.name ? `${file.folder.name.replace(/[\\/]+/g, '-')}/` : ''
        archive.append(stream, { name: uniqueName(`${prefix}${entryName}`) })
      } catch (error) {
        console.error(`Skipping ${file.name} in archive:`, error)
      }
    }

    await createAuditLog(req.user!.id, 'file.bulk_downloaded', 'file', undefined, {
      count: files.length,
      ip: req.ip,
    })
    return await archive.finalize()
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      include: fileInclude,
    })
    if (!file) throw HttpError.notFound('File not found.')
    return res.json({ file: serializeFile(file) })
  } catch (error) {
    return next(error)
  }
})

fileRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(1).max(255).optional(),
        folderId: z.string().uuid().nullable().optional(),
        starred: z.boolean().optional(),
      })
      .parse(req.body)

    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      include: { connectedAccount: true },
    })
    if (!file) throw HttpError.notFound('File not found.')

    if (body.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: body.folderId, userId: req.user!.id, deletedAt: null },
        select: { id: true },
      })
      if (!folder) throw HttpError.notFound('Destination folder not found.')
    }

    // Rename at the provider first: if Drive rejects it, the local record
    // should not drift out of sync with the actual file.
    if (body.name && file.provider !== 's3') {
      const drive = google.drive({
        version: 'v3',
        auth: await getAuthedGoogleClient(file.connectedAccount),
      })
      await drive.files.update({ fileId: file.providerFileId, requestBody: { name: body.name } })
    }

    const updated = await prisma.file.update({
      where: { id: file.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
        ...(body.starred !== undefined
          ? { starred: body.starred, starredAt: body.starred ? new Date() : null }
          : {}),
      },
      include: fileInclude,
    })

    if (body.name || body.folderId !== undefined) {
      await createAuditLog(req.user!.id, 'file.updated', 'file', updated.id, {
        name: updated.name,
        renamed: Boolean(body.name),
        moved: body.folderId !== undefined,
        ip: req.ip,
      })
    }
    return res.json({ file: serializeFile(updated) })
  } catch (error) {
    return next(error)
  }
})

const shareSchema = z.object({
  /** Days until the link stops working. Omit for a link that never expires. */
  expiresInDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
  password: z.string().min(4).max(128).nullable().optional(),
})

fileRouter.post('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const body = shareSchema.parse(req.body ?? {})
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id, status: 'active' },
      select: { id: true, name: true },
    })
    if (!file) throw HttpError.notFound('File not found.')

    const existing = await prisma.fileShare.findFirst({
      where: {
        fileId: file.id,
        userId: req.user!.id,
        enabled: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    })

    const expiresAt =
      body.expiresInDays === null || body.expiresInDays === undefined
        ? null
        : new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)

    const passwordHash =
      body.password === undefined
        ? undefined
        : body.password === null
          ? null
          : await hashPassword(body.password)

    if (existing) {
      const share = await prisma.fileShare.update({
        where: { id: existing.id },
        data: {
          ...(body.expiresInDays !== undefined ? { expiresAt } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
      })
      return res.json({
        shareId: share.id,
        url: shareUrl(share),
        hasPassword: Boolean(share.passwordHash),
        expiresAt: share.expiresAt?.toISOString() ?? null,
      })
    }

    // The raw token is encrypted rather than stored in plaintext: a database
    // dump should not hand over every live share link.
    const token = randomToken(32)
    const share = await prisma.fileShare.create({
      data: {
        fileId: file.id,
        userId: req.user!.id,
        tokenEncrypted: encryptText(token),
        tokenHash: hashToken(token),
        passwordHash: passwordHash ?? null,
        expiresAt,
      },
    })

    await createAuditLog(req.user!.id, 'share.created', 'file_share', share.id, {
      fileId: file.id,
      hasPassword: Boolean(passwordHash),
      expiresAt: expiresAt?.toISOString() ?? null,
      ip: req.ip,
    })

    return res.status(201).json({
      shareId: share.id,
      url: `${env.FRONTEND_URL}/public/files/${token}`,
      hasPassword: Boolean(passwordHash),
      expiresAt: expiresAt?.toISOString() ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const { count } = await prisma.fileShare.updateMany({
      where: { fileId: String(req.params.id), userId: req.user!.id, enabled: true },
      data: { enabled: false },
    })
    if (count > 0) {
      await createAuditLog(req.user!.id, 'share.revoked', 'file_share', String(req.params.id), {
        ip: req.ip,
      })
    }
    return res.json({ status: 'ok', revoked: count })
  } catch (error) {
    return next(error)
  }
})

fileRouter.post('/:id/preview-token', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id, status: 'active' },
      select: { id: true },
    })
    if (!file) throw HttpError.notFound('File not found.')

    const token = randomToken(32)
    await prisma.filePreviewToken.create({
      data: {
        fileId: file.id,
        userId: req.user!.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    })

    // Opening a preview counts as viewing, which is what Recent orders by.
    await prisma.file.update({ where: { id: file.id }, data: { lastViewedAt: new Date() } })

    const path = `/files/preview/${token}`
    // Built from configured APP_URL, not the Host header.
    return res.status(201).json({ path, url: `${env.APP_URL.replace(/\/+$/, '')}${path}` })
  } catch (error) {
    return next(error)
  }
})

/**
 * Grants anyone-with-the-link read access at Google and returns Drive's own
 * link.
 *
 * Upstream used `role: 'writer'` here *and* did it as a side effect of simply
 * fetching the view URL, so opening a file quietly gave the whole internet
 * edit rights to it. This endpoint now requires an explicit POST, grants
 * `reader` only, and records what happened.
 */
fileRouter.post('/:id/public-link', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id, status: 'active' },
      include: { connectedAccount: true },
    })
    if (!file) throw HttpError.notFound('File not found.')
    if (file.provider !== 'google_drive') {
      throw HttpError.badRequest(
        'Only Google Drive files can be given a provider link. Use a Better Drive share link instead.',
        'UNSUPPORTED_PROVIDER',
      )
    }

    const drive = google.drive({
      version: 'v3',
      auth: await getAuthedGoogleClient(file.connectedAccount),
    })
    await drive.permissions.create({
      fileId: file.providerFileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })
    const metadata = await drive.files.get({
      fileId: file.providerFileId,
      fields: 'webViewLink,webContentLink',
    })

    await createAuditLog(req.user!.id, 'file.google_public_link_created', 'file', file.id, {
      name: file.name,
      ip: req.ip,
    })

    return res.json({
      status: 'ok',
      url: metadata.data.webViewLink ?? metadata.data.webContentLink ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

/** Read-only: returns Drive's link if one exists, changing no permissions. */
fileRouter.get('/:id/view-url', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      include: { connectedAccount: true },
    })
    if (!file) throw HttpError.notFound('File not found.')
    if (file.provider === 's3') return res.json({ url: null })

    const drive = google.drive({
      version: 'v3',
      auth: await getAuthedGoogleClient(file.connectedAccount),
    })
    const metadata = await drive.files.get({
      fileId: file.providerFileId,
      fields: 'webViewLink,webContentLink',
    })
    return res.json({ url: metadata.data.webViewLink ?? metadata.data.webContentLink ?? null })
  } catch (error) {
    return next(error)
  }
})

fileRouter.get('/:id/download', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      include: { connectedAccount: true },
    })
    if (!file) throw HttpError.notFound('File not found.')
    return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' })
  } catch (error) {
    return next(error)
  }
})

fileRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id, status: 'active' },
      select: { id: true, name: true },
    })
    if (!file) throw HttpError.notFound('File not found.')

    await prisma.file.update({
      where: { id: file.id },
      data: { status: 'deleted', deletedAt: new Date() },
    })
    await createAuditLog(req.user!.id, 'file.trashed', 'file', file.id, {
      name: file.name,
      ip: req.ip,
    })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

/** Empties the trash, permanently deleting at the provider as it goes. */
fileRouter.delete('/trash/all', async (req: AuthRequest, res, next) => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.id, status: 'deleted' },
      select: { id: true },
      take: 1000,
    })
    if (files.length === 0) return res.json({ status: 'ok', deleted: 0 })

    // Reuse the per-file provider deletion path in batches rather than
    // duplicating it, so provider cleanup stays in one place.
    let deleted = 0
    for (const batch of chunk(files.map((file) => file.id), 100)) {
      const response = await fetch(`${env.APP_URL.replace(/\/+$/, '')}/files/batch/permanent`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.header('Authorization') ?? '',
        },
        body: JSON.stringify({ fileIds: batch }),
      })
      const data = (await response.json().catch(() => ({}))) as { deleted?: number }
      deleted += data.deleted ?? 0
    }
    return res.json({ status: 'ok', deleted })
  } catch (error) {
    return next(error)
  }
})
