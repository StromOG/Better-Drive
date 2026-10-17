import type { SftpAccessProfile, SftpAuthorizedKey } from '@prisma/client'
import ssh2 from 'ssh2'
import { prisma } from '../config/prisma.js'
import { writeSftpAuditLog } from './audit.js'
import { computeSha256Fingerprint } from './hostKey.js'
import { isIpRateLimited, recordAuthFailure, recordAuthSuccess } from './limits.js'

export interface AuthenticatedSftpSession {
  userId: string
  key: SftpAuthorizedKey
  profile: SftpAccessProfile
  remoteIp: string
}

function checkIpInAllowlist(clientIp: string, allowlistJson: string | null): boolean {
  if (!allowlistJson) return true
  try {
    const list: string[] = JSON.parse(allowlistJson)
    if (!Array.isArray(list) || list.length === 0) return true
    const cleanClient = clientIp.replace(/^::ffff:/, '')
    return list.some((item) => {
      const cleanItem = item.trim()
      if (cleanItem === cleanClient) return true
      if (cleanItem.includes('/')) {
        // Basic CIDR check or exact match
        const [subnet, bitsStr] = cleanItem.split('/')
        const bits = parseInt(bitsStr, 10)
        if (isNaN(bits)) return false
        // Simple IPv4 mask check
        const ipToNum = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0
        if (subnet.includes('.') && cleanClient.includes('.')) {
          const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
          return (ipToNum(cleanClient) & mask) === (ipToNum(subnet) & mask)
        }
      }
      return false
    })
  } catch {
    return true
  }
}

export async function handleSftpAuth(
  ctx: ssh2.AuthContext,
  remoteIp: string,
): Promise<AuthenticatedSftpSession | null> {
  const cleanIp = remoteIp.replace(/^::ffff:/, '')

  if (isIpRateLimited(cleanIp)) {
    await writeSftpAuditLog({
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: 'rate_limited',
    })
    ctx.reject(['publickey'])
    return null
  }

  if (ctx.method !== 'publickey') {
    recordAuthFailure(cleanIp)
    await writeSftpAuditLog({
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: `method:${ctx.method}`,
    })
    ctx.reject(['publickey'])
    return null
  }

  const pubKeyData = ctx.key.data
  const fingerprint = computeSha256Fingerprint(pubKeyData)

  const authorizedKey = await prisma.sftpAuthorizedKey.findUnique({
    where: { fingerprint },
    include: {
      profile: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!authorizedKey) {
    recordAuthFailure(cleanIp)
    await writeSftpAuditLog({
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: `unknown_key:${fingerprint}`,
    })
    ctx.reject(['publickey'])
    return null
  }

  if (authorizedKey.revokedAt !== null) {
    recordAuthFailure(cleanIp)
    await writeSftpAuditLog({
      keyId: authorizedKey.id,
      userId: authorizedKey.profile.userId,
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: 'key_revoked',
    })
    ctx.reject(['publickey'])
    return null
  }

  if (!authorizedKey.profile.enabled || authorizedKey.profile.user.status !== 'active') {
    recordAuthFailure(cleanIp)
    await writeSftpAuditLog({
      keyId: authorizedKey.id,
      userId: authorizedKey.profile.userId,
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: 'profile_or_user_disabled',
    })
    ctx.reject(['publickey'])
    return null
  }

  if (!checkIpInAllowlist(cleanIp, authorizedKey.profile.ipAllowlist)) {
    recordAuthFailure(cleanIp)
    await writeSftpAuditLog({
      keyId: authorizedKey.id,
      userId: authorizedKey.profile.userId,
      remoteIp: cleanIp,
      event: 'AUTH_FAIL',
      outcome: 'DENIED',
      path: 'ip_not_allowed',
    })
    ctx.reject(['publickey'])
    return null
  }

  // If ctx.signature is undefined, this is a publickey probe check
  if (!ctx.signature) {
    ctx.accept()
    return null
  }

  try {
    const parsedKey = ssh2.utils.parseKey(authorizedKey.publicKey)
    if (parsedKey instanceof Error || !parsedKey) {
      recordAuthFailure(cleanIp)
      ctx.reject(['publickey'])
      return null
    }

    if (!ctx.blob) {
      recordAuthFailure(cleanIp)
      ctx.reject(['publickey'])
      return null
    }

    const isValid = parsedKey.verify(ctx.blob, ctx.signature)
    if (!isValid) {
      recordAuthFailure(cleanIp)
      await writeSftpAuditLog({
        keyId: authorizedKey.id,
        userId: authorizedKey.profile.userId,
        remoteIp: cleanIp,
        event: 'AUTH_FAIL',
        outcome: 'DENIED',
        path: 'invalid_signature',
      })
      ctx.reject(['publickey'])
      return null
    }

    recordAuthSuccess(cleanIp)
    await prisma.sftpAuthorizedKey.update({
      where: { id: authorizedKey.id },
      data: { lastUsedAt: new Date() },
    })

    await writeSftpAuditLog({
      keyId: authorizedKey.id,
      userId: authorizedKey.profile.userId,
      remoteIp: cleanIp,
      event: 'AUTH_OK',
      outcome: 'OK',
    })

    ctx.accept()
    return {
      userId: authorizedKey.profile.userId,
      key: authorizedKey,
      profile: authorizedKey.profile,
      remoteIp: cleanIp,
    }
  } catch {
    recordAuthFailure(cleanIp)
    ctx.reject(['publickey'])
    return null
  }
}
