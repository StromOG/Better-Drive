import { google } from 'googleapis'
import type { ConnectedAccount, ProviderConfig } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { decryptText, encryptText } from '../../utils/crypto.js'

const googleDriveFolderMimeType = 'application/vnd.google-apps.folder'

/** Name of the folder Better Drive creates in each connected Drive account. */
export const appFolderName = env.DRIVE_ROOT_FOLDER

export function createOAuthClient(config: ProviderConfig) {
  return new google.auth.OAuth2(decryptText(config.clientIdEncrypted), decryptText(config.clientSecretEncrypted), config.redirectUri)
}

export async function getAuthedGoogleClient(account: ConnectedAccount) {
  if (!account.accessTokenEncrypted || !account.refreshTokenEncrypted || !account.tokenExpiresAt) throw new Error('Google account tokens are missing.')
  if (!account.providerConfigId) throw new Error('Google provider config is missing.')
  const config = await prisma.providerConfig.findUniqueOrThrow({ where: { id: account.providerConfigId } })
  const client = createOAuthClient(config)
  client.setCredentials({
    access_token: decryptText(account.accessTokenEncrypted),
    refresh_token: decryptText(account.refreshTokenEncrypted),
    expiry_date: account.tokenExpiresAt.getTime(),
  })

  if (account.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    const result = await client.refreshAccessToken()
    const credentials = result.credentials
    if (credentials.access_token) {
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEncrypted: encryptText(credentials.access_token),
          tokenExpiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
        },
      })
      client.setCredentials(credentials)
    }
  }

  return client
}

export async function syncGoogleQuota(accountId: string) {
  const account = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: accountId } })
  const auth = await getAuthedGoogleClient(account)
  const drive = google.drive({ version: 'v3', auth })
  const about = await drive.about.get({ fields: 'storageQuota,user' })
  const quota = about.data.storageQuota
  const total = quota?.limit ? BigInt(quota.limit) : null
  const used = quota?.usage ? BigInt(quota.usage) : 0n
  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: {
      connectedAccountId: accountId,
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      trashBytes: quota?.usageInDriveTrash ? BigInt(quota.usageInDriveTrash) : null,
      lastSyncedAt: new Date(),
    },
    update: {
      totalBytes: total,
      usedBytes: used,
      availableBytes: total === null ? null : total - used,
      trashBytes: quota?.usageInDriveTrash ? BigInt(quota.usageInDriveTrash) : null,
      lastSyncedAt: new Date(),
    },
  })
}

/** Drive's query language is string-based, so values must be escaped. */
function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups
}

export async function ensureGoogleAppFolder(account: ConnectedAccount) {
  const auth = await getAuthedGoogleClient(account)
  const drive = google.drive({ version: 'v3', auth })
  const queryName = escapeDriveQueryValue(appFolderName)
  const existing = await drive.files.list({
    q: `name = '${queryName}' and mimeType = '${googleDriveFolderMimeType}' and 'root' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: 1,
  })
  const folderId = existing.data.files?.[0]?.id ?? (await drive.files.create({
    requestBody: { name: appFolderName, mimeType: googleDriveFolderMimeType, parents: ['root'] },
    fields: 'id',
  })).data.id

  if (!folderId) throw new Error('Failed to create Google Drive app folder.')
  return folderId
}

export type GoogleAppFolderSyncResult = {
  accountId: string
  created: number
  updated: number
  deleted: number
}

type DriveFileMetadata = {
  id: string
  name: string
  mimeType: string
  sizeBytes: bigint
  parentId: string
  /** Drive's own MD5, reused for duplicate detection without re-reading bytes. */
  checksum: string | null
}

export async function syncGoogleAppFolderFiles(accountId: string, userId: string): Promise<GoogleAppFolderSyncResult> {
  const account = await prisma.connectedAccount.findFirstOrThrow({ where: { id: accountId, userId, provider: 'google_drive', status: 'connected' } })
  const auth = await getAuthedGoogleClient(account)
  const drive = google.drive({ version: 'v3', auth })
  const appFolderId = await ensureGoogleAppFolder(account)

  const userFolders = await prisma.folder.findMany({
    where: { userId, connectedAccountId: account.id, deletedAt: null },
    select: { id: true, providerFolderId: true }
  })
  const parentIds = [
    appFolderId,
    ...userFolders.map((f) => f.providerFolderId).filter((id): id is string => !!id)
  ]

  const driveFiles: DriveFileMetadata[] = []

  // Drive's `q` parameter has a length limit, so parents are queried in
  // batches rather than one giant OR chain.
  for (const parentBatch of chunk(parentIds, 50)) {
    const parentsQuery = parentBatch
      .map((id) => `'${escapeDriveQueryValue(id)}' in parents`)
      .join(' or ')
    const q = `(${parentsQuery}) and mimeType != '${googleDriveFolderMimeType}' and trashed = false`
    let pageToken: string | undefined

    do {
      const response = await drive.files.list({
        q,
        spaces: 'drive',
        fields: 'nextPageToken,files(id,name,mimeType,size,parents,md5Checksum)',
        pageSize: 1000,
        pageToken,
      })
      for (const file of response.data.files ?? []) {
        if (!file.id || !file.name || !file.mimeType) continue
        driveFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: BigInt(file.size ?? 0),
          parentId: file.parents?.[0] ?? appFolderId,
          checksum: file.md5Checksum ?? null,
        })
      }
      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  const existingFiles = await prisma.file.findMany({
    where: { userId, connectedAccountId: account.id, provider: 'google_drive' },
    select: {
      id: true,
      providerFileId: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      checksum: true,
      status: true,
      deletedAt: true,
      folderId: true,
    },
  })
  const existingByProviderId = new Map(existingFiles.map((file) => [file.providerFileId, file]))
  const driveFileIds = new Set(driveFiles.map((file) => file.id))
  const folderIdMap = new Map(userFolders.map((folder) => [folder.providerFolderId, folder.id]))

  // Collect the work first, then write in batches. Doing a round trip per
  // file made syncing a folder of a few thousand files take minutes.
  const toCreate: {
    userId: string
    connectedAccountId: string
    provider: string
    providerFileId: string
    name: string
    mimeType: string
    sizeBytes: bigint
    checksum: string | null
    status: string
    folderId: string | null
  }[] = []
  const toUpdate: { id: string; data: Record<string, unknown> }[] = []

  for (const driveFile of driveFiles) {
    const dbFolderId =
      driveFile.parentId === appFolderId ? null : (folderIdMap.get(driveFile.parentId) ?? null)
    const existing = existingByProviderId.get(driveFile.id)

    if (!existing) {
      toCreate.push({
        userId,
        connectedAccountId: account.id,
        provider: 'google_drive',
        providerFileId: driveFile.id,
        name: driveFile.name,
        mimeType: driveFile.mimeType,
        sizeBytes: driveFile.sizeBytes,
        checksum: driveFile.checksum,
        status: 'active',
        folderId: dbFolderId,
      })
      continue
    }

    const needsUpdate =
      existing.name !== driveFile.name ||
      existing.mimeType !== driveFile.mimeType ||
      existing.sizeBytes !== driveFile.sizeBytes ||
      existing.checksum !== driveFile.checksum ||
      existing.status !== 'active' ||
      existing.deletedAt !== null ||
      existing.folderId !== dbFolderId

    if (needsUpdate) {
      toUpdate.push({
        id: existing.id,
        data: {
          name: driveFile.name,
          mimeType: driveFile.mimeType,
          sizeBytes: driveFile.sizeBytes,
          checksum: driveFile.checksum,
          status: 'active',
          deletedAt: null,
          folderId: dbFolderId,
        },
      })
    }
  }

  let created = 0
  for (const batch of chunk(toCreate, 500)) {
    const result = await prisma.file.createMany({ data: batch })
    created += result.count
  }

  let updated = 0
  for (const batch of chunk(toUpdate, 100)) {
    await prisma.$transaction(
      batch.map((item) => prisma.file.update({ where: { id: item.id }, data: item.data })),
    )
    updated += batch.length
  }

  const missingActiveIds = existingFiles
    .filter((file) => file.status === 'active' && !driveFileIds.has(file.providerFileId))
    .map((file) => file.id)

  let deleted = 0
  if (missingActiveIds.length > 0) {
    // Files removed on Drive are marked deleted rather than dropped, so they
    // show up in the trash instead of vanishing.
    const result = await prisma.file.updateMany({
      where: { id: { in: missingActiveIds }, userId },
      data: { status: 'deleted', deletedAt: new Date() },
    })
    deleted = result.count
  }

  await syncGoogleQuota(account.id).catch(() => undefined)
  return { accountId: account.id, created, updated, deleted }
}
