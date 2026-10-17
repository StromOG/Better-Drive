import { prisma } from '../../config/prisma.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { createAuditLog } from '../../utils/audit.js'
import { hashToken, randomToken } from '../../utils/crypto.js'
import { serializeJson } from '../../utils/json-column.js'

export function serializeApiKey(key: {
  id: string
  userId: string
  label?: string | null
  name: string
  keyPrefix: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  status: string
}) {
  return {
    id: key.id,
    userId: key.userId,
    label: key.label ?? key.name,
    name: key.name,
    keyPrefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
    status: key.revokedAt ? 'revoked' : key.status,
  }
}

export async function createApiKey(userId: string, label: string, ip?: string) {
  const rawSecret = `bd_live_${randomToken(32)}`
  const keyHash = hashToken(rawSecret)
  const keyPrefix = rawSecret.slice(0, 16)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      label,
      name: label,
      keyPrefix,
      keyHash,
      scopes: serializeJson(['*']),
      status: 'active',
    },
  })

  // Never log raw secret in audit logs
  await createAuditLog(userId, 'api_key.created', 'api_key', apiKey.id, {
    label,
    keyPrefix,
    ip,
  })

  return {
    apiKey: serializeApiKey(apiKey),
    plaintext: rawSecret,
  }
}

export async function listApiKeys(userId: string) {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return keys.map(serializeApiKey)
}

export async function revokeApiKey(userId: string, id: string, ip?: string) {
  const existing = await prisma.apiKey.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    throw new HttpError(404, 'NOT_FOUND', 'API key not found.')
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  })

  await createAuditLog(userId, 'api_key.revoked', 'api_key', id, {
    label: existing.label ?? existing.name,
    keyPrefix: existing.keyPrefix,
    ip,
  })

  return serializeApiKey(updated)
}
