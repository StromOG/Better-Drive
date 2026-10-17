import { prisma } from '../../config/prisma.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { createAuditLog } from '../../utils/audit.js'
import { getAuthedGoogleClient, syncGoogleQuota } from '../google/google.service.js'
import { syncS3Quota, testS3Connection } from '../s3/s3.service.js'

export function serializeConnectedAccount(account: any) {
  const { accessTokenEncrypted: _a, refreshTokenEncrypted: _r, storageAccount, ...rest } = account
  return {
    ...rest,
    storageAccount: storageAccount
      ? {
          ...storageAccount,
          totalBytes: storageAccount.totalBytes?.toString() ?? null,
          usedBytes: storageAccount.usedBytes?.toString() ?? '0',
          availableBytes: storageAccount.availableBytes?.toString() ?? null,
          trashBytes: storageAccount.trashBytes?.toString() ?? null,
        }
      : null,
  }
}

export async function patchAccount(
  userId: string,
  accountId: string,
  data: { label?: string; enabled?: boolean },
  ip?: string,
) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
    include: { s3StorageConfig: true },
  })

  if (!account) {
    throw new HttpError(404, 'NOT_FOUND', 'Connected account not found.')
  }

  const updateData: { displayName?: string; enabled?: boolean } = {}
  if (data.label !== undefined) updateData.displayName = data.label
  if (data.enabled !== undefined) updateData.enabled = data.enabled

  const [updated] = await prisma.$transaction([
    prisma.connectedAccount.update({
      where: { id: accountId },
      data: updateData,
      include: { storageAccount: true, s3StorageConfig: true },
    }),
    ...(data.label !== undefined && account.s3StorageConfig
      ? [
          prisma.s3StorageConfig.update({
            where: { id: account.s3StorageConfig.id },
            data: { name: data.label },
          }),
        ]
      : []),
  ])

  await createAuditLog(userId, 'connected_account.updated', 'connected_account', accountId, {
    label: data.label,
    enabled: data.enabled,
    ip,
  })

  return serializeConnectedAccount(updated)
}

export async function disconnectAccount(userId: string, accountId: string, ip?: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
  })

  if (!account) {
    throw new HttpError(404, 'NOT_FOUND', 'Connected account not found.')
  }

  // Mark revoked and disconnected, keeping files and roots intact
  const updated = await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      status: 'disconnected',
      revokedAt: new Date(),
    },
  })

  await createAuditLog(userId, 'connected_account.disconnected', 'connected_account', accountId, {
    provider: account.provider,
    email: account.email,
    ip,
  })

  return { status: 'ok', account: serializeConnectedAccount(updated) }
}

export async function reauthAccount(userId: string, accountId: string, ip?: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
    include: { s3StorageConfig: true, storageAccount: true },
  })

  if (!account) {
    throw new HttpError(404, 'NOT_FOUND', 'Connected account not found.')
  }

  try {
    if (account.provider === 's3') {
      if (!account.s3StorageConfig) {
        throw new Error('S3 configuration missing')
      }
      await testS3Connection(account.s3StorageConfig)
      await syncS3Quota(account.id).catch(() => undefined)
    } else {
      // Google Drive
      const auth = await getAuthedGoogleClient(account)
      if (!auth) {
        throw new Error('Unable to authenticate Google client')
      }
      await syncGoogleQuota(account.id).catch(() => undefined)
    }

    // Reauth successful: clear revokedAt and restore status
    const updated = await prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: 'connected',
        revokedAt: null,
        lastError: null,
      },
    })

    await createAuditLog(userId, 'connected_account.reauthed', 'connected_account', accountId, {
      provider: account.provider,
      ip,
    })

    return { status: 'ok', state: 'healthy', account: serializeConnectedAccount(updated) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reauth failed'
    await prisma.connectedAccount.update({
      where: { id: accountId },
      data: { lastError: message },
    })
    throw new HttpError(401, 'ACCOUNT_REAUTH_REQUIRED', message)
  }
}

export async function getAccountHealth(userId: string, accountId: string) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: accountId, userId },
    include: { storageAccount: true },
  })

  if (!account) {
    throw new HttpError(404, 'NOT_FOUND', 'Connected account not found.')
  }

  let state: 'healthy' | 'reauth_required' | 'error' = 'healthy'
  if (account.revokedAt || account.status === 'disconnected') {
    state = 'reauth_required'
  } else if (account.lastError) {
    state = 'error'
  }

  return {
    quotaUsed: account.storageAccount?.usedBytes.toString() ?? '0',
    quotaTotal: account.storageAccount?.totalBytes?.toString() ?? null,
    lastSyncAt: account.storageAccount?.lastSyncedAt?.toISOString() ?? null,
    lastError: account.lastError ?? null,
    state,
  }
}
