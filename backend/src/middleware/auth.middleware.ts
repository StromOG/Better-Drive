import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { hashToken } from '../utils/crypto.js'
import { verifyAccessToken } from '../utils/jwt.js'

export type UserRole = 'owner' | 'admin' | 'member'

export type AuthRequest = Request & {
  user?: { id: string; sessionId: string; role: UserRole; isApiKey?: boolean }
}

function asRole(value: string): UserRole {
  return value === 'owner' || value === 'admin' ? value : 'member'
}

const apiKeyRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkApiKeyRateLimit(keyId: string): boolean {
  const now = Date.now()
  const windowMs = env.API_KEY_RATE_LIMIT_WINDOW_MS
  const max = env.API_KEY_RATE_LIMIT_MAX
  const entry = apiKeyRateLimits.get(keyId)
  if (!entry || now > entry.resetAt) {
    apiKeyRateLimits.set(keyId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) {
    return false
  }
  entry.count++
  return true
}

async function authenticateApiKey(token: string, req: AuthRequest, res: Response, next: NextFunction) {
  const keyHash = hashToken(token)
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, role: true, status: true } } },
  })
  if (!apiKey) {
    return res.status(401).json({ code: 'API_KEY_INVALID', message: 'API key is invalid.' })
  }
  if (apiKey.status !== 'active' || apiKey.revokedAt) {
    return res.status(401).json({ code: 'API_KEY_REVOKED', message: 'API key has been revoked.' })
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return res.status(401).json({ code: 'API_KEY_INVALID', message: 'API key has expired.' })
  }
  if (apiKey.user.status !== 'active') {
    return res.status(403).json({ code: 'AUTH_ACCOUNT_DISABLED', message: 'This account has been disabled.' })
  }
  if (!checkApiKeyRateLimit(apiKey.id)) {
    return res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'API key rate limit exceeded.' })
  }
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
  req.user = { id: apiKey.userId, sessionId: apiKey.id, role: asRole(apiKey.user.role), isApiKey: true }
  return next()
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Bearer token required.' })
    }

    const token = header.slice(7).trim()
    if (!token) {
      return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Bearer token required.' })
    }

    if (token.startsWith('bd_')) {
      return await authenticateApiKey(token, req, res, next)
    }

    try {
      const payload = verifyAccessToken(token)
      const session = await prisma.userSession.findUnique({
        where: { id: payload.sid },
        select: {
          revokedAt: true,
          expiresAt: true,
          user: { select: { id: true, role: true, status: true } },
        },
      })

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return res.status(401).json({ code: 'AUTH_SESSION_EXPIRED', message: 'Session expired.' })
      }

      if (session.user.status !== 'active') {
        return res
          .status(403)
          .json({ code: 'AUTH_ACCOUNT_DISABLED', message: 'This account has been disabled.' })
      }

      req.user = { id: payload.sub, sessionId: payload.sid, role: asRole(session.user.role), isApiKey: false }
      return next()
    } catch {
      return await authenticateApiKey(token, req, res, next)
    }
  } catch (error) {
    return next(error)
  }
}

/**
 * Guards endpoints that act on the whole installation rather than on the
 * caller's own data: the global OAuth client, database backup and restore,
 * other people's accounts.
 *
 * Must be mounted after `requireAuth`, which is what populates `req.user`.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Authentication required.' })
  }
  if (req.user.role !== 'owner' && req.user.role !== 'admin') {
    return res.status(403).json({
      code: 'FORBIDDEN_ADMIN_ONLY',
      message: 'This action requires an administrator account.',
    })
  }
  return next()
}

/** Guards actions only the installation owner may take, such as demoting admins. */
export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Authentication required.' })
  }
  if (req.user.role !== 'owner') {
    return res
      .status(403)
      .json({ code: 'FORBIDDEN_OWNER_ONLY', message: 'This action requires the owner account.' })
  }
  return next()
}
