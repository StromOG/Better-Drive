import crypto from 'node:crypto'
import { PassThrough, Readable } from 'node:stream'
import { google } from 'googleapis'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '../config/prisma.js'
import { SftpError, SftpErrorCode } from './errors.js'
import type { VfsAccountMapping, VfsResolvedTarget } from './vfs.js'
import { getAuthedGoogleClient, ensureGoogleAppFolder } from '../modules/google/google.service.js'
import {
  buildS3ObjectKey,
  createS3Client,
  deleteS3Object,
  getS3ConfigForAccount,
  uploadS3Object,
} from '../modules/s3/s3.service.js'
import { normalizeHeaders } from '../modules/files/stream-google-file.js'

export interface SftpDirItem {
  filename: string
  longname: string
  attrs: {
    mode: number
    size: number
    mtime: number
    atime: number
    uid?: number
    gid?: number
  }
}

export function sanitizeLabel(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'account'
}

export async function getUserAccountMappings(userId: string): Promise<VfsAccountMapping[]> {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, status: 'connected', provider: { in: ['google_drive', 's3', 'mock'] } },
    include: { s3StorageConfig: true },
  })

  return accounts.map((acc) => {
    let rawName = acc.email
    if (acc.provider === 's3' && acc.s3StorageConfig) {
      rawName = acc.s3StorageConfig.name || acc.s3StorageConfig.bucket
    }
    const label = `${sanitizeLabel(rawName)}-${acc.id.slice(0, 6)}`
    return {
      id: acc.id,
      label,
      provider: acc.provider as 'google_drive' | 's3' | 'mock',
    }
  })
}

function makeAttrs(isDir: boolean, size = 0, mtime = Math.floor(Date.now() / 1000)) {
  const S_IFDIR = 0o040000
  const S_IFREG = 0o100000
  const mode = (isDir ? S_IFDIR : S_IFREG) | (isDir ? 0o755 : 0o644)
  return {
    mode,
    size,
    mtime,
    atime: mtime,
    uid: 0,
    gid: 0,
  }
}

function makeLongname(name: string, isDir: boolean, size = 0, mtimeDate = new Date()) {
  const dateStr = mtimeDate.toISOString().slice(0, 10)
  const prefix = isDir ? 'drwxr-xr-x 1 betterdrive betterdrive' : '-rw-r--r-- 1 betterdrive betterdrive'
  return `${prefix} ${String(size).padStart(10, ' ')} ${dateStr} ${name}`
}

/**
 * Lists contents of a resolved VFS directory.
 */
export async function listVfsDirectory(
  target: VfsResolvedTarget,
  userId: string,
  accounts: VfsAccountMapping[],
  allowedRoots: string[],
): Promise<SftpDirItem[]> {
  const items: SftpDirItem[] = []

  if (target.type === 'root') {
    if (allowedRoots.includes('pool') || allowedRoots.includes('*') || allowedRoots.includes('pool/*')) {
      items.push({
        filename: 'pool',
        longname: makeLongname('pool', true),
        attrs: makeAttrs(true),
      })
    }
    const hasDrive = accounts.some((a) => a.provider === 'google_drive')
    if (hasDrive) {
      items.push({
        filename: 'drive',
        longname: makeLongname('drive', true),
        attrs: makeAttrs(true),
      })
    }
    const hasS3 = accounts.some((a) => a.provider === 's3')
    if (hasS3) {
      items.push({
        filename: 's3',
        longname: makeLongname('s3', true),
        attrs: makeAttrs(true),
      })
    }
    return items
  }

  if (target.type === 'drive_root') {
    const driveAccounts = accounts.filter((a) => a.provider === 'google_drive')
    for (const acc of driveAccounts) {
      items.push({
        filename: acc.label,
        longname: makeLongname(acc.label, true),
        attrs: makeAttrs(true),
      })
    }
    return items
  }

  if (target.type === 's3_root') {
    const s3Accounts = accounts.filter((a) => a.provider === 's3')
    for (const acc of s3Accounts) {
      items.push({
        filename: acc.label,
        longname: makeLongname(acc.label, true),
        attrs: makeAttrs(true),
      })
    }
    return items
  }

  // Inside an account root, pool, or subpath
  let folderId: string | null = null
  let accountId = target.accountId

  if (target.subPath) {
    const segments = target.subPath.split('/').filter(Boolean)
    let currentParent: string | null = null

    for (const seg of segments) {
      const matchFolder: any = await prisma.folder.findFirst({
        where: {
          userId,
          deletedAt: null,
          parentId: currentParent,
          name: seg,
          ...(accountId ? { connectedAccountId: accountId } : {}),
        },
      })
      if (!matchFolder) {
        throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, `Folder not found: ${seg}`)
      }
      currentParent = matchFolder.id
      if (!accountId) accountId = matchFolder.connectedAccountId
    }
    folderId = currentParent
  }

  // Find child folders
  const folders = await prisma.folder.findMany({
    where: {
      userId,
      deletedAt: null,
      parentId: folderId,
      ...(accountId ? { connectedAccountId: accountId } : {}),
    },
  })

  for (const f of folders) {
    const mtimeSec = Math.floor(f.updatedAt.getTime() / 1000)
    items.push({
      filename: f.name,
      longname: makeLongname(f.name, true, 0, f.updatedAt),
      attrs: makeAttrs(true, 0, mtimeSec),
    })
  }

  // Find child files
  const files = await prisma.file.findMany({
    where: {
      userId,
      status: 'active',
      folderId,
      ...(accountId ? { connectedAccountId: accountId } : {}),
    },
  })

  for (const f of files) {
    const size = Number(f.sizeBytes)
    const mtimeSec = Math.floor(f.updatedAt.getTime() / 1000)
    items.push({
      filename: f.name,
      longname: makeLongname(f.name, false, size, f.updatedAt),
      attrs: makeAttrs(false, size, mtimeSec),
    })
  }

  return items
}

/**
 * Returns stat attrs for a target.
 */
export async function statVfsTarget(
  target: VfsResolvedTarget,
  userId: string,
): Promise<{ attrs: SftpDirItem['attrs']; isDir: boolean }> {
  if (target.type === 'root' || target.type === 'pool_root' || target.type === 'drive_root' || target.type === 's3_root' || target.type === 'account_root') {
    return { attrs: makeAttrs(true), isDir: true }
  }

  if (!target.subPath) {
    return { attrs: makeAttrs(true), isDir: true }
  }

  const segments = target.subPath.split('/').filter(Boolean)
  const targetName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  for (const seg of parentSegments) {
    const parentFolder: any = await prisma.folder.findFirst({
      where: {
        userId,
        deletedAt: null,
        parentId,
        name: seg,
        ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
      },
    })
    if (!parentFolder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Parent directory not found')
    parentId = parentFolder.id
  }

  // Check if directory
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      deletedAt: null,
      parentId,
      name: targetName,
      ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
    },
  })
  if (folder) {
    return { attrs: makeAttrs(true, 0, Math.floor(folder.updatedAt.getTime() / 1000)), isDir: true }
  }

  // Check if file
  const file = await prisma.file.findFirst({
    where: {
      userId,
      status: 'active',
      folderId: parentId,
      name: targetName,
      ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
    },
  })
  if (file) {
    const size = Number(file.sizeBytes)
    return { attrs: makeAttrs(false, size, Math.floor(file.updatedAt.getTime() / 1000)), isDir: false }
  }

  throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'File or folder not found')
}

/**
 * Creates a readable stream for a file.
 */
export async function openReadVfsFile(
  target: VfsResolvedTarget,
  userId: string,
): Promise<{ stream: Readable; size: bigint; name: string }> {
  if (!target.subPath) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot read directory')

  const segments = target.subPath.split('/').filter(Boolean)
  const targetName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  for (const seg of parentSegments) {
    const parentFolder: any = await prisma.folder.findFirst({
      where: { userId, deletedAt: null, parentId, name: seg, ...(target.accountId ? { connectedAccountId: target.accountId } : {}) },
    })
    if (!parentFolder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Path not found')
    parentId = parentFolder.id
  }

  const file = await prisma.file.findFirst({
    where: {
      userId,
      status: 'active',
      folderId: parentId,
      name: targetName,
      ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
    },
    include: { connectedAccount: true },
  })

  if (!file) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'File not found')

  if (file.provider === 's3') {
    const config = await getS3ConfigForAccount(file.connectedAccountId)
    const client = createS3Client(config)
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: file.providerFileId }))
    const bodyStream = response.Body as Readable
    return { stream: bodyStream, size: file.sizeBytes, name: file.name }
  }

  // Google Drive
  const auth = await getAuthedGoogleClient(file.connectedAccount)
  const headers = normalizeHeaders(await auth.getRequestHeaders())
  const url = `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`
  const res = await fetch(url, { headers })
  if (!res.ok || !res.body) throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'Failed to fetch from Google Drive')

  const webStream = res.body
  const nodeStream = Readable.fromWeb(webStream as any)
  return { stream: nodeStream, size: file.sizeBytes, name: file.name }
}

/**
 * Writes an uploaded stream to storage and creates database records with SHA-256 checksum.
 */
export async function writeVfsFile(
  target: VfsResolvedTarget,
  userId: string,
  inputStream: Readable,
): Promise<{ id: string; name: string; sizeBytes: bigint; checksum: string }> {
  if (!target.subPath) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot write to root')

  const segments = target.subPath.split('/').filter(Boolean)
  const fileName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  let accountId = target.accountId

  for (const seg of parentSegments) {
    let parentFolder: any = await prisma.folder.findFirst({
      where: { userId, deletedAt: null, parentId, name: seg, ...(accountId ? { connectedAccountId: accountId } : {}) },
    })
    if (!parentFolder) {
      if (!accountId) {
        const firstAcc = await prisma.connectedAccount.findFirst({ where: { userId, status: 'connected' } })
        if (!firstAcc) throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'No connected storage accounts')
        accountId = firstAcc.id
      }
      parentFolder = await prisma.folder.create({
        data: { userId, connectedAccountId: accountId, name: seg, parentId },
      })
    }
    parentId = parentFolder.id
    if (!accountId) accountId = parentFolder.connectedAccountId
  }

  if (!accountId) {
    const acc = await prisma.connectedAccount.findFirst({ where: { userId, status: 'connected' } })
    if (!acc) throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'No connected storage account')
    accountId = acc.id
  }

  const account = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: accountId } })

  // Pipe through SHA-256 hasher and pass-through buffer stream
  const hash = crypto.createHash('sha256')
  let byteCount = 0n
  const passThrough = new PassThrough()

  inputStream.on('data', (chunk: Buffer) => {
    hash.update(chunk)
    byteCount += BigInt(chunk.length)
  })

  let providerFileId: string
  const provisionalFileId = crypto.randomUUID()

  if (account.provider === 's3') {
    const config = await getS3ConfigForAccount(account.id)
    providerFileId = buildS3ObjectKey(config, userId, provisionalFileId, fileName)
    inputStream.pipe(passThrough)
    await uploadS3Object(config, providerFileId, passThrough, 'application/octet-stream')
  } else if (account.provider === 'mock') {
    providerFileId = `mock-${provisionalFileId}`
    inputStream.pipe(passThrough)
    await new Promise<void>((resolve, reject) => {
      passThrough.on('data', () => {})
      passThrough.on('end', resolve)
      passThrough.on('error', reject)
    })
  } else {
    const auth = await getAuthedGoogleClient(account)
    const drive = google.drive({ version: 'v3', auth })
    const appFolderId = await ensureGoogleAppFolder(account)
    inputStream.pipe(passThrough)
    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: [appFolderId] },
      media: { mimeType: 'application/octet-stream', body: passThrough },
      fields: 'id,name,mimeType,size',
    })
    providerFileId = uploaded.data.id ?? ''
  }

  const checksum = hash.digest('hex')

  const file = await prisma.file.create({
    data: {
      userId,
      connectedAccountId: account.id,
      folderId: parentId,
      provider: account.provider,
      providerFileId,
      name: fileName,
      mimeType: 'application/octet-stream',
      sizeBytes: byteCount,
      checksum,
      status: 'active',
    },
  })

  return {
    id: file.id,
    name: file.name,
    sizeBytes: file.sizeBytes,
    checksum,
  }
}

/**
 * Removes a file (unlink).
 */
export async function unlinkVfsFile(target: VfsResolvedTarget, userId: string): Promise<void> {
  if (!target.subPath) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot unlink root')

  const segments = target.subPath.split('/').filter(Boolean)
  const fileName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  for (const seg of parentSegments) {
    const parentFolder: any = await prisma.folder.findFirst({
      where: { userId, deletedAt: null, parentId, name: seg, ...(target.accountId ? { connectedAccountId: target.accountId } : {}) },
    })
    if (!parentFolder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'File not found')
    parentId = parentFolder.id
  }

  const file = await prisma.file.findFirst({
    where: {
      userId,
      status: 'active',
      folderId: parentId,
      name: fileName,
      ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
    },
    include: { connectedAccount: true },
  })

  if (!file) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'File not found')

  if (file.provider === 's3') {
    await deleteS3Object(file).catch(() => undefined)
  }

  await prisma.file.update({
    where: { id: file.id },
    data: { status: 'deleted', deletedAt: new Date() },
  })
}

/**
 * Creates a directory (mkdir).
 */
export async function mkdirVfsDirectory(target: VfsResolvedTarget, userId: string): Promise<void> {
  if (!target.subPath) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot mkdir on root')

  const segments = target.subPath.split('/').filter(Boolean)
  const dirName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  let accountId = target.accountId

  for (const seg of parentSegments) {
    const parentFolder: any = await prisma.folder.findFirst({
      where: { userId, deletedAt: null, parentId, name: seg, ...(accountId ? { connectedAccountId: accountId } : {}) },
    })
    if (!parentFolder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, `Parent path not found: ${seg}`)
    parentId = parentFolder.id
    if (!accountId) accountId = parentFolder.connectedAccountId
  }

  if (!accountId) {
    const acc = await prisma.connectedAccount.findFirst({ where: { userId, status: 'connected' } })
    if (!acc) throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'No connected storage accounts')
    accountId = acc.id
  }

  await prisma.folder.create({
    data: {
      userId,
      connectedAccountId: accountId,
      name: dirName,
      parentId,
    },
  })
}

/**
 * Removes a directory (rmdir).
 */
export async function rmdirVfsDirectory(target: VfsResolvedTarget, userId: string): Promise<void> {
  if (!target.subPath) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot rmdir root')

  const segments = target.subPath.split('/').filter(Boolean)
  const dirName = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let parentId: string | null = null
  for (const seg of parentSegments) {
    const parentFolder: any = await prisma.folder.findFirst({
      where: { userId, deletedAt: null, parentId, name: seg, ...(target.accountId ? { connectedAccountId: target.accountId } : {}) },
    })
    if (!parentFolder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Folder not found')
    parentId = parentFolder.id
  }

  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      deletedAt: null,
      parentId,
      name: dirName,
      ...(target.accountId ? { connectedAccountId: target.accountId } : {}),
    },
  })

  if (!folder) throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Folder not found')

  await prisma.folder.update({
    where: { id: folder.id },
    data: { deletedAt: new Date() },
  })
}

/**
 * Renames a file or folder.
 */
export async function renameVfsTarget(
  oldTarget: VfsResolvedTarget,
  newTarget: VfsResolvedTarget,
  userId: string,
): Promise<void> {
  if (!oldTarget.subPath || !newTarget.subPath) {
    throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Cannot rename roots')
  }

  const oldSegments = oldTarget.subPath.split('/').filter(Boolean)
  const oldName = oldSegments[oldSegments.length - 1]
  const newSegments = newTarget.subPath.split('/').filter(Boolean)
  const newName = newSegments[newSegments.length - 1]

  // Try file first
  const file = await prisma.file.findFirst({
    where: {
      userId,
      status: 'active',
      name: oldName,
      ...(oldTarget.accountId ? { connectedAccountId: oldTarget.accountId } : {}),
    },
  })

  if (file) {
    await prisma.file.update({
      where: { id: file.id },
      data: { name: newName },
    })
    return
  }

  // Try folder
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      deletedAt: null,
      name: oldName,
      ...(oldTarget.accountId ? { connectedAccountId: oldTarget.accountId } : {}),
    },
  })

  if (folder) {
    await prisma.folder.update({
      where: { id: folder.id },
      data: { name: newName },
    })
    return
  }

  throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'File or folder to rename not found')
}
