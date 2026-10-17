import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth.middleware.js'
import { HttpError } from '../middleware/error.middleware.js'
import { computeSha256Fingerprint, loadOrCreateHostKey } from './hostKey.js'
import { getSftpStatus, startSftpServer, stopSftpServer } from './sftpGateway.js'

export const sftpAdminRouter = Router()
export const sftpUserRouter = Router()

// Schema validators
const createProfileSchema = z.object({
  userId: z.string().uuid(),
  label: z.string().min(1).max(191),
  allowRead: z.boolean().default(true),
  allowWrite: z.boolean().default(false),
  allowDelete: z.boolean().default(false),
  allowedRoots: z.array(z.string()).default(['pool']),
  maxUploadBytes: z.coerce.number().positive().optional(),
  ipAllowlist: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
})

const updateProfileSchema = z.object({
  label: z.string().min(1).max(191).optional(),
  allowRead: z.boolean().optional(),
  allowWrite: z.boolean().optional(),
  allowDelete: z.boolean().optional(),
  allowedRoots: z.array(z.string()).optional(),
  maxUploadBytes: z.coerce.number().positive().nullable().optional(),
  ipAllowlist: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
})

const addKeySchema = z.object({
  label: z.string().min(1).max(191),
  publicKey: z.string().min(20),
})

// ─── Admin Endpoints (/system/sftp/*) ──────────────────────────────────────────

sftpAdminRouter.get('/status', requireAuth, requireAdmin, (_req, res) => {
  return res.json(getSftpStatus())
})

sftpAdminRouter.post('/enable', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const success = await startSftpServer()
    if (!success) {
      throw HttpError.badRequest('Failed to start SFTP gateway. Check host key or port binding.')
    }
    return res.json({ status: 'enabled', ...getSftpStatus() })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.post('/disable', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    await stopSftpServer()
    return res.json({ status: 'disabled', ...getSftpStatus() })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.get('/hostkey', requireAuth, requireAdmin, (_req, res, next) => {
  try {
    const keyData = loadOrCreateHostKey(env.SFTP_HOST_KEY_PATH)
    return res.json({
      fingerprint: keyData.fingerprint,
      publicKey: keyData.publicKeyOpenSsh,
    })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.get('/profiles', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const profiles = await prisma.sftpAccessProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        keys: {
          select: { id: true, label: true, fingerprint: true, lastUsedAt: true, revokedAt: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({
      profiles: profiles.map((p) => ({
        ...p,
        allowedRoots: JSON.parse(p.allowedRoots || '[]'),
        ipAllowlist: p.ipAllowlist ? JSON.parse(p.ipAllowlist) : null,
        maxUploadBytes: p.maxUploadBytes !== null ? p.maxUploadBytes.toString() : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.post('/profiles', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createProfileSchema.parse(req.body)
    const profile = await prisma.sftpAccessProfile.create({
      data: {
        userId: parsed.userId,
        label: parsed.label,
        allowRead: parsed.allowRead,
        allowWrite: parsed.allowWrite,
        allowDelete: parsed.allowDelete,
        allowedRoots: JSON.stringify(parsed.allowedRoots),
        maxUploadBytes: parsed.maxUploadBytes ? BigInt(parsed.maxUploadBytes) : null,
        ipAllowlist: parsed.ipAllowlist ? JSON.stringify(parsed.ipAllowlist) : null,
        enabled: parsed.enabled,
      },
    })
    return res.status(201).json({
      ...profile,
      allowedRoots: parsed.allowedRoots,
      ipAllowlist: parsed.ipAllowlist ?? null,
      maxUploadBytes: profile.maxUploadBytes !== null ? profile.maxUploadBytes.toString() : null,
    })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.patch('/profiles/:id', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateProfileSchema.parse(req.body)
    const data: Record<string, unknown> = {}

    if (parsed.label !== undefined) data.label = parsed.label
    if (parsed.allowRead !== undefined) data.allowRead = parsed.allowRead
    if (parsed.allowWrite !== undefined) data.allowWrite = parsed.allowWrite
    if (parsed.allowDelete !== undefined) data.allowDelete = parsed.allowDelete
    if (parsed.allowedRoots !== undefined) data.allowedRoots = JSON.stringify(parsed.allowedRoots)
    if (parsed.maxUploadBytes !== undefined) {
      data.maxUploadBytes = parsed.maxUploadBytes ? BigInt(parsed.maxUploadBytes) : null
    }
    if (parsed.ipAllowlist !== undefined) {
      data.ipAllowlist = parsed.ipAllowlist ? JSON.stringify(parsed.ipAllowlist) : null
    }
    if (parsed.enabled !== undefined) data.enabled = parsed.enabled

    const id = String(req.params.id)
    const updated = await prisma.sftpAccessProfile.update({
      where: { id },
      data,
    })
    return res.json({
      ...updated,
      allowedRoots: JSON.parse(updated.allowedRoots || '[]'),
      ipAllowlist: updated.ipAllowlist ? JSON.parse(updated.ipAllowlist) : null,
      maxUploadBytes: updated.maxUploadBytes !== null ? updated.maxUploadBytes.toString() : null,
    })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.delete('/profiles/:id', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id)
    await prisma.sftpAccessProfile.delete({ where: { id } })
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.post('/profiles/:id/keys', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const parsed = addKeySchema.parse(req.body)
    const fingerprint = computeSha256Fingerprint(parsed.publicKey)

    const profileId = String(req.params.id)
    const key = await prisma.sftpAuthorizedKey.create({
      data: {
        profileId,
        label: parsed.label,
        publicKey: parsed.publicKey.trim(),
        fingerprint,
      },
    })
    return res.status(201).json(key)
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.delete('/profiles/:id/keys/:keyId', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const profileId = String(req.params.id)
    const keyId = String(req.params.keyId)
    await prisma.sftpAuthorizedKey.update({
      where: { id: keyId, profileId },
      data: { revokedAt: new Date() },
    })
    return res.json({ success: true, revokedAt: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

sftpAdminRouter.get('/sessions', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)))
    const skip = (page - 1) * limit

    const [total, sessions] = await Promise.all([
      prisma.sftpSessionLog.count(),
      prisma.sftpSessionLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return res.json({
      sessions: sessions.map((s) => ({
        ...s,
        bytes: s.bytes !== null ? s.bytes.toString() : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Per-User Endpoints (/me/sftp/*) ──────────────────────────────────────────

sftpUserRouter.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id
    let profile = await prisma.sftpAccessProfile.findFirst({
      where: { userId },
      include: {
        keys: {
          select: { id: true, label: true, fingerprint: true, lastUsedAt: true, revokedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // If user has no profile yet, create a default self profile
    if (!profile) {
      profile = await prisma.sftpAccessProfile.create({
        data: {
          userId,
          label: 'Default SFTP',
          allowRead: true,
          allowWrite: false,
          allowDelete: false,
          allowedRoots: JSON.stringify(['pool']),
          enabled: true,
        },
        include: { keys: true },
      })
    }

    const hostKey = getSftpStatus()

    return res.json({
      status: hostKey,
      profile: {
        ...profile,
        allowedRoots: JSON.parse(profile.allowedRoots || '[]'),
        ipAllowlist: profile.ipAllowlist ? JSON.parse(profile.ipAllowlist) : null,
        maxUploadBytes: profile.maxUploadBytes !== null ? profile.maxUploadBytes.toString() : null,
      },
    })
  } catch (err) {
    next(err)
  }
})

sftpUserRouter.post('/keys', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id
    const parsed = addKeySchema.parse(req.body)
    const fingerprint = computeSha256Fingerprint(parsed.publicKey)

    let profile = await prisma.sftpAccessProfile.findFirst({ where: { userId } })
    if (!profile) {
      profile = await prisma.sftpAccessProfile.create({
        data: {
          userId,
          label: 'Default SFTP',
          allowRead: true,
          allowWrite: false,
          allowDelete: false,
          allowedRoots: JSON.stringify(['pool']),
          enabled: true,
        },
      })
    }

    const existingKey = await prisma.sftpAuthorizedKey.findUnique({ where: { fingerprint } })
    if (existingKey) {
      throw HttpError.conflict('An authorized key with this fingerprint already exists.')
    }

    const key = await prisma.sftpAuthorizedKey.create({
      data: {
        profileId: profile.id,
        label: parsed.label,
        publicKey: parsed.publicKey.trim(),
        fingerprint,
      },
    })

    return res.status(201).json(key)
  } catch (err) {
    next(err)
  }
})

sftpUserRouter.delete('/keys/:keyId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id
    const keyId = String(req.params.keyId)
    const key = await prisma.sftpAuthorizedKey.findFirst({
      where: {
        id: keyId,
        profile: { userId },
      },
    })

    if (!key) throw HttpError.notFound('Key not found.')

    await prisma.sftpAuthorizedKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    })

    return res.json({ success: true, revokedAt: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})
