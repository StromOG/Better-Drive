import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { hashToken } from '../utils/crypto.js'
import { parseStringArray } from '../utils/json-column.js'
import type { UserRole } from './auth.middleware.js'

export type ApiKeyRequest = Request & {
  user?: { id: string; sessionId: string; role: UserRole }
  apiKey?: { id: string; scopes: string[] }
}

export function requireApiKey(scope: string) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const header = req.header('Authorization')
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ code: 'API_KEY_REQUIRED', message: 'API key required.' })
      }

      const rawKey = header.slice(7).trim()
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash: hashToken(rawKey) },
        include: { user: { select: { role: true, status: true } } },
      })

      if (
        !apiKey ||
        apiKey.status !== 'active' ||
        apiKey.revokedAt ||
        (apiKey.expiresAt && apiKey.expiresAt <= new Date())
      ) {
        return res.status(401).json({ code: 'API_KEY_INVALID', message: 'Invalid API key.' })
      }

      // A key must stop working when its owner is disabled.
      if (apiKey.user.status !== 'active') {
        return res
          .status(403)
          .json({ code: 'AUTH_ACCOUNT_DISABLED', message: 'This account has been disabled.' })
      }

      const scopes = parseStringArray(apiKey.scopes)
      if (!scopes.includes(scope)) {
        return res
          .status(403)
          .json({ code: 'API_KEY_FORBIDDEN', message: 'API key does not have required scope.' })
      }

      const role = apiKey.user.role
      req.user = {
        id: apiKey.userId,
        sessionId: `api-key:${apiKey.id}`,
        role: role === 'owner' || role === 'admin' ? role : 'member',
      }
      req.apiKey = { id: apiKey.id, scopes }
      await prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined)
      return next()
    } catch {
      return res.status(401).json({ code: 'API_KEY_INVALID', message: 'Invalid API key.' })
    }
  }
}
