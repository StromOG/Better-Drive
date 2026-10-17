import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { parseStringArray, serializeJson } from '../../utils/json-column.js'

export const storageRouter = Router()
storageRouter.use(requireAuth)


const routingModes = ['most_available', 'round_robin', 'priority'] as const
const routingPolicySchema = z.object({ mode: z.enum(routingModes), priorityAccountIds: z.array(z.string().min(1)).max(100).optional() })

async function getOrCreateRoutingPolicy(userId: string) {
  return prisma.uploadRoutingPolicy.upsert({
    where: { userId },
    create: { userId, mode: 'most_available', priorityAccountIds: serializeJson([]) },
    update: {},
  })
}

storageRouter.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const accounts = await prisma.connectedAccount.findMany({ where: { userId: req.user!.id, status: 'connected' }, include: { storageAccount: true } })
    const summary = accounts.reduce((acc, account) => {
      const storage = account.storageAccount
      acc.totalBytes += storage?.totalBytes ?? 0n
      acc.usedBytes += storage?.usedBytes ?? 0n
      acc.availableBytes += storage?.availableBytes ?? 0n
      return acc
    }, { totalBytes: 0n, usedBytes: 0n, availableBytes: 0n })

    return res.json({
      totalBytes: summary.totalBytes.toString(),
      usedBytes: summary.usedBytes.toString(),
      availableBytes: summary.availableBytes.toString(),
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        status: account.status,
        totalBytes: account.storageAccount?.totalBytes?.toString() ?? null,
        usedBytes: account.storageAccount?.usedBytes.toString() ?? '0',
        availableBytes: account.storageAccount?.availableBytes?.toString() ?? null,
        lastSyncedAt: account.storageAccount?.lastSyncedAt ?? null,
      })),
    })
  } catch (error) {
    return next(error)
  }
})

storageRouter.get('/routing-policy', async (req: AuthRequest, res, next) => {
  try {
    const policy = await getOrCreateRoutingPolicy(req.user!.id)
    return res.json({ policy: { id: policy.id, mode: policy.mode, priorityAccountIds: parseStringArray(policy.priorityAccountIds), roundRobinCursor: policy.roundRobinCursor } })
  } catch (error) {
    return next(error)
  }
})

storageRouter.patch('/routing-policy', async (req: AuthRequest, res, next) => {
  try {
    const body = routingPolicySchema.parse(req.body)
    const accountIds = [...new Set(body.priorityAccountIds ?? [])]
    const validAccounts = accountIds.length === 0 ? [] : await prisma.connectedAccount.findMany({ where: { id: { in: accountIds }, userId: req.user!.id, status: 'connected' }, select: { id: true } })
    const validIds = new Set(validAccounts.map((account) => account.id))
    const priorityAccountIds = accountIds.filter((id) => validIds.has(id))
    const policy = await prisma.uploadRoutingPolicy.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, mode: body.mode, priorityAccountIds: serializeJson(priorityAccountIds), roundRobinCursor: 0 },
      update: { mode: body.mode, priorityAccountIds: serializeJson(priorityAccountIds), ...(body.mode !== 'round_robin' ? { roundRobinCursor: 0 } : {}) },
    })
    return res.json({ policy: { id: policy.id, mode: policy.mode, priorityAccountIds: parseStringArray(policy.priorityAccountIds), roundRobinCursor: policy.roundRobinCursor } })
  } catch (error) {
    return next(error)
  }
})

const photoExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif', 'raw', 'cr2', 'nef', 'arw'])
const videoExtensions = new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'])
const audioExtensions = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'opus'])
const documentExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'tsv', 'parquet', 'epub', 'pages', 'numbers', 'key'])
const archiveExtensions = new Set(['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2', 'xz', 'iso', 'dmg'])
const codeExtensions = new Set([
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'css', 'scss', 'less',
  'html', 'htm', 'xml', 'md', 'markdown', 'py', 'pyw', 'rb', 'go', 'rs', 'c',
  'cpp', 'h', 'hpp', 'cs', 'java', 'kt', 'swift', 'php', 'sh', 'bash', 'zsh',
  'ps1', 'bat', 'cmd', 'sql', 'yml', 'yaml', 'toml', 'ini', 'env', 'lock',
  'dockerfile', 'graphql', 'proto', 'vue', 'svelte'
])

export function classifyFileCategory(name: string, mimeType?: string | null): 'photo' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other' {
  const ext = (name.toLowerCase().split('.').pop() || '').trim()
  const mime = (mimeType || '').toLowerCase().trim()

  if (photoExtensions.has(ext) || mime.startsWith('image/')) return 'photo'
  if (videoExtensions.has(ext) || mime.startsWith('video/')) return 'video'
  if (audioExtensions.has(ext) || mime.startsWith('audio/')) return 'audio'
  if (archiveExtensions.has(ext) || mime === 'application/zip' || mime === 'application/x-tar' || mime === 'application/x-7z-compressed' || mime === 'application/x-rar-compressed' || mime === 'application/gzip') return 'archive'
  if (codeExtensions.has(ext) || mime === 'text/javascript' || mime === 'application/json' || mime === 'text/css' || mime === 'text/html' || mime === 'application/typescript' || mime === 'text/markdown' || mime === 'text/x-python' || mime === 'application/xml' || mime === 'text/yaml' || mime === 'application/x-yaml' || mime === 'application/toml') return 'code'
  if (documentExtensions.has(ext) || mime === 'application/pdf' || mime.includes('officedocument') || mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.startsWith('application/vnd.google-apps.')) return 'document'

  return 'other'
}

storageRouter.get('/breakdown', async (req: AuthRequest, res, next) => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.id, status: 'active' },
      select: { name: true, mimeType: true, sizeBytes: true },
    })

    const categorySums: Record<string, bigint> = {
      photo: 0n,
      video: 0n,
      audio: 0n,
      document: 0n,
      archive: 0n,
      code: 0n,
      other: 0n,
    }

    for (const file of files) {
      const category = classifyFileCategory(file.name, file.mimeType)
      categorySums[category] = (categorySums[category] ?? 0n) + file.sizeBytes
    }

    const breakdown: Record<string, string> = {
      photo: categorySums.photo.toString(),
      video: categorySums.video.toString(),
      audio: categorySums.audio.toString(),
      document: categorySums.document.toString(),
      archive: categorySums.archive.toString(),
      code: categorySums.code.toString(),
      other: categorySums.other.toString(),
    }

    const dedupGroups = await prisma.file.groupBy({
      by: ['checksum'],
      where: { userId: req.user!.id, status: 'active', checksum: { not: null } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
      having: { checksum: { _count: { gt: 1 } } },
    })

    let deduplicatedSavings = 0n
    for (const group of dedupGroups) {
      const count = BigInt(group._count._all)
      if (count > 1n && group._sum.sizeBytes) {
        const unitBytes = group._sum.sizeBytes / count
        deduplicatedSavings += unitBytes * (count - 1n)
      }
    }

    return res.json({
      ...breakdown,
      deduplicatedSavings: deduplicatedSavings.toString(),
    })
  } catch (error) {
    return next(error)
  }
})
