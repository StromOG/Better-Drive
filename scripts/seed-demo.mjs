import argon2 from 'argon2'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../backend/dist/config/prisma.js'

export async function seedDemoData() {
  console.log('[*] Seeding demo instance data for screenshots and local tour...')

  const passwordHash = await argon2.hash('DemoPassword2026!')
  const email = 'demo@betterdrive.local'

  // 1. Create or update owner user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Demo Administrator',
      passwordHash,
      role: 'owner',
      status: 'active',
    },
    create: {
      email,
      name: 'Demo Administrator',
      passwordHash,
      role: 'owner',
      status: 'active',
    },
  })

  const userId = user.id

  // 2. Clear old demo data for clean repeatable run
  await prisma.sftpAuthorizedKey.deleteMany({ where: { profile: { userId } } })
  await prisma.sftpAccessProfile.deleteMany({ where: { userId } })
  await prisma.apiKey.deleteMany({ where: { userId } })
  await prisma.notificationPreference.deleteMany({ where: { userId } })
  await prisma.invitation.deleteMany({ where: { invitedById: userId } })
  await prisma.fileShare.deleteMany({ where: { file: { userId } } })
  await prisma.file.deleteMany({ where: { userId } })
  await prisma.folder.deleteMany({ where: { userId } })
  await prisma.storageAccount.deleteMany({ where: { connectedAccount: { userId } } })
  await prisma.s3StorageConfig.deleteMany({ where: { userId } })
  await prisma.connectedAccount.deleteMany({ where: { userId } })

  // 3. Connect 2 Google Drives & 1 S3 Bucket
  const personalDrive = await prisma.connectedAccount.create({
    data: {
      userId,
      provider: 'google_drive',
      providerAccountId: 'gdrive-personal-001',
      email: 'personal.drive@betterdrive.local',
      displayName: 'Personal Google Drive',
      scopes: '["drive.file"]',
      status: 'connected',
      storageAccount: {
        create: {
          totalBytes: BigInt(15 * 1024 * 1024 * 1024), // 15 GB
          usedBytes: BigInt(4820 * 1024 * 1024), // 4.82 GB (~32%)
          availableBytes: BigInt(10540 * 1024 * 1024),
          trashBytes: BigInt(120 * 1024 * 1024),
          lastSyncedAt: new Date(),
        },
      },
    },
  })

  const workDrive = await prisma.connectedAccount.create({
    data: {
      userId,
      provider: 'google_drive',
      providerAccountId: 'gdrive-work-002',
      email: 'work.vault@betterdrive.local',
      displayName: 'Work Workspace Pool',
      scopes: '["drive.file"]',
      status: 'connected',
      storageAccount: {
        create: {
          totalBytes: BigInt(100 * 1024 * 1024 * 1024), // 100 GB
          usedBytes: BigInt(34800 * 1024 * 1024), // 34.8 GB (~35%)
          availableBytes: BigInt(65200 * 1024 * 1024),
          trashBytes: BigInt(450 * 1024 * 1024),
          lastSyncedAt: new Date(),
        },
      },
    },
  })

  const backupS3 = await prisma.connectedAccount.create({
    data: {
      userId,
      provider: 's3',
      providerAccountId: 's3-backup-003',
      email: 's3-us-east-1@betterdrive.local',
      displayName: 'Offsite Backups (Wasabi/S3)',
      scopes: '["s3:FullAccess"]',
      status: 'connected',
      s3StorageConfig: {
        create: {
          userId,
          name: 'Primary Wasabi Bucket',
          bucket: 'betterdrive-offsite-vault',
          region: 'us-east-1',
          endpoint: 'https://s3.wasabisys.com',
          accessKeyIdEncrypted: 'mock-encrypted-key',
          secretAccessKeyEncrypted: 'mock-encrypted-secret',
          prefix: 'vault',
          quotaBytes: BigInt(500 * 1024 * 1024 * 1024), // 500 GB
          status: 'active',
        },
      },
      storageAccount: {
        create: {
          totalBytes: BigInt(500 * 1024 * 1024 * 1024), // 500 GB
          usedBytes: BigInt(128500 * 1024 * 1024), // 128.5 GB (~25%)
          availableBytes: BigInt(371500 * 1024 * 1024),
          trashBytes: BigInt(0),
          lastSyncedAt: new Date(),
        },
      },
    },
  })

  // 4. Create Folders
  const folderDocs = await prisma.folder.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      name: 'Engineering Documents',
      provider: 'google_drive',
      providerFolderId: 'folder-docs-01',
    },
  })

  const folderMedia = await prisma.folder.create({
    data: {
      userId,
      connectedAccountId: workDrive.id,
      name: 'Product Media & Footage',
      provider: 'google_drive',
      providerFolderId: 'folder-media-02',
    },
  })

  const folderSource = await prisma.folder.create({
    data: {
      userId,
      connectedAccountId: workDrive.id,
      name: 'Release Archives',
      provider: 'google_drive',
      providerFolderId: 'folder-release-03',
    },
  })

  // 5. Create Realistic Multi-Category Files
  const fileDocsPdf = await prisma.file.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      folderId: folderDocs.id,
      provider: 'google_drive',
      providerFileId: 'file-doc-pdf-01',
      name: 'Infrastructure-Architecture-RFC-42.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(4850000), // 4.85 MB
      checksum: crypto.createHash('sha256').update('rfc42-pdf').digest('hex'),
      starred: true,
      starredAt: new Date(Date.now() - 3600000),
      status: 'active',
      updatedAt: new Date(Date.now() - 7200000),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      folderId: folderDocs.id,
      provider: 'google_drive',
      providerFileId: 'file-doc-xlsx-02',
      name: 'Quarterly-Storage-Financials-Q3.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: BigInt(1250000), // 1.25 MB
      checksum: crypto.createHash('sha256').update('fin-xlsx').digest('hex'),
      starred: false,
      status: 'active',
      updatedAt: new Date(Date.now() - 86400000),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: workDrive.id,
      folderId: null,
      provider: 'google_drive',
      providerFileId: 'file-code-ts-03',
      name: 'sftpGateway.ts',
      mimeType: 'text/typescript',
      sizeBytes: BigInt(42500), // 42.5 KB
      checksum: crypto.createHash('sha256').update('sftp-ts').digest('hex'),
      starred: true,
      starredAt: new Date(Date.now() - 1800000),
      status: 'active',
      updatedAt: new Date(Date.now() - 1800000),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: workDrive.id,
      folderId: folderMedia.id,
      provider: 'google_drive',
      providerFileId: 'file-media-mp4-04',
      name: 'BetterDrive-Keynote-Walkthrough-4K.mp4',
      mimeType: 'video/mp4',
      sizeBytes: BigInt(485000000), // 485 MB
      checksum: crypto.createHash('sha256').update('walkthrough-mp4').digest('hex'),
      starred: true,
      starredAt: new Date(Date.now() - 86400000 * 2),
      status: 'active',
      updatedAt: new Date(Date.now() - 86400000 * 2),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: workDrive.id,
      folderId: folderMedia.id,
      provider: 'google_drive',
      providerFileId: 'file-media-mp3-05',
      name: 'Executive-Summary-VoiceBriefing.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: BigInt(14200000), // 14.2 MB
      checksum: crypto.createHash('sha256').update('voice-mp3').digest('hex'),
      starred: false,
      status: 'active',
      updatedAt: new Date(Date.now() - 86400000 * 3),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      folderId: null,
      provider: 'google_drive',
      providerFileId: 'file-img-png-06',
      name: 'BetterDrive-HighRes-BrandLogo.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(1820000), // 1.82 MB
      checksum: crypto.createHash('sha256').update('brand-png').digest('hex'),
      starred: false,
      status: 'active',
      updatedAt: new Date(Date.now() - 86400000 * 4),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: backupS3.id,
      folderId: folderSource.id,
      provider: 's3',
      providerFileId: 'file-zip-tar-07',
      name: 'Full-System-Snapshot-2026-v1.tar.gz',
      mimeType: 'application/gzip',
      sizeBytes: BigInt(840000000), // 840 MB
      checksum: crypto.createHash('sha256').update('snapshot-tar').digest('hex'),
      starred: false,
      status: 'active',
      updatedAt: new Date(Date.now() - 86400000 * 5),
    },
  })

  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      folderId: null,
      provider: 'google_drive',
      providerFileId: 'file-notes-txt-09',
      name: 'Production-Readiness-Checklist.txt',
      mimeType: 'text/plain',
      sizeBytes: BigInt(8420),
      checksum: crypto.createHash('sha256').update('prod-checklist-txt').digest('hex'),
      starred: true,
      starredAt: new Date(Date.now() - 3600000),
      status: 'active',
      updatedAt: new Date(Date.now() - 3600000),
    },
  })

  // 6. Create one trashed file
  await prisma.file.create({
    data: {
      userId,
      connectedAccountId: personalDrive.id,
      folderId: null,
      provider: 'google_drive',
      providerFileId: 'file-trashed-08',
      name: 'Draft-Meeting-Notes-Obsolete.txt',
      mimeType: 'text/plain',
      sizeBytes: BigInt(12400),
      checksum: crypto.createHash('sha256').update('obsolete-notes').digest('hex'),
      status: 'trash',
      deletedAt: new Date(Date.now() - 3600000 * 12),
      updatedAt: new Date(Date.now() - 3600000 * 12),
    },
  })

  // 7. Create one shared link
  const rawShareToken = 'bd_share_sec_7f9a1b2c3d4e5f60'
  const shareTokenHash = crypto.createHash('sha256').update(rawShareToken).digest('hex')

  await prisma.fileShare.create({
    data: {
      fileId: fileDocsPdf.id,
      userId,
      tokenHash: shareTokenHash,
      enabled: true,
      createdAt: new Date(),
    },
  })

  // 8. Setup SFTP profile and authorized key
  const sftpProfile = await prisma.sftpAccessProfile.create({
    data: {
      userId,
      label: 'Admin Workstation & Termius',
      allowRead: true,
      allowWrite: true,
      allowDelete: true,
      allowedRoots: JSON.stringify(['pool']),
      enabled: true,
    },
  })

  await prisma.sftpAuthorizedKey.create({
    data: {
      profileId: sftpProfile.id,
      label: 'MacBook Pro Termius Key (Ed25519)',
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyTermiusDevice2026',
      fingerprint: 'SHA256:4x9mB7qL1kZ9p8v2T6wY5uX3rA1sD4fG7hJ0kL2mN5o',
    },
  })

  // 10. Seed team members, pending invitation, API keys, and notifications
  await prisma.user.upsert({
    where: { email: 'sarah.dev@betterdrive.local' },
    update: { name: 'Sarah Chen', role: 'admin', status: 'active' },
    create: {
      email: 'sarah.dev@betterdrive.local',
      name: 'Sarah Chen',
      passwordHash,
      role: 'admin',
      status: 'active',
    },
  })

  await prisma.invitation.create({
    data: {
      email: 'alex.engineer@betterdrive.local',
      role: 'member',
      tokenHash: crypto.createHash('sha256').update('demo-token-alex').digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      invitedById: userId,
    },
  })

  await prisma.apiKey.create({
    data: {
      userId,
      name: 'Production Backup Daemon',
      label: 'Production Backup Daemon',
      keyPrefix: 'bd_live_a1b2',
      keyHash: crypto.createHash('sha256').update('bd_live_mock_secret_key_prod').digest('hex'),
      status: 'active',
      scopes: JSON.stringify(['read', 'write']),
      lastUsedAt: new Date(Date.now() - 3600 * 1000),
    },
  })

  await prisma.apiKey.create({
    data: {
      userId,
      name: 'Staging Ingest Worker',
      label: 'Staging Ingest Worker',
      keyPrefix: 'bd_live_c3d4',
      keyHash: crypto.createHash('sha256').update('bd_live_mock_secret_key_staging').digest('hex'),
      status: 'revoked',
      scopes: JSON.stringify(['read']),
      lastUsedAt: new Date(Date.now() - 86400 * 1000 * 5),
    },
  })

  const prefEvents = ['upload.complete', 'upload.failed', 'storage.warning', 'member.invited', 'member.role_changed']
  for (const eventType of prefEvents) {
    await prisma.notificationPreference.upsert({
      where: { userId_eventType_channel: { userId, eventType, channel: 'in_app' } },
      update: { enabled: true },
      create: { userId, eventType, channel: 'in_app', enabled: true },
    })
  }

  // 11. Reset mascot settings to clean arctic-pure (white/light) theme
  const settingsFile = path.resolve('backend/data/mascot_settings.json')
  try {
    let settings = {}
    try {
      settings = JSON.parse(await fs.promises.readFile(settingsFile, 'utf-8'))
    } catch {
      // ignore missing or invalid file
    }
    settings[userId] = {
      accessory: 'none',
      colorTheme: 'candy',
      soundEnabled: true,
      hasSeenTour: true,
      position: null,
      minimized: false,
      dashboardTheme: 'arctic-pure',
      avatarUrl: '',
    }
    await fs.promises.mkdir(path.dirname(settingsFile), { recursive: true })
    await fs.promises.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
  } catch {
    // ignore
  }

  console.log(`[OK] Demo instance seeded:
  - User: ${email}
  - Accounts: 2 Google Drive (15 GB + 100 GB) + 1 Wasabi S3 (500 GB)
  - Team: 1 Admin (Sarah Chen) + 1 Pending Invitation (Alex Engineer)
  - API Keys: 2 (1 Active, 1 Revoked)
  - Notifications: 5 in-app channels configured
  - Files: 7 active across all categories + 1 trashed + 1 shared
  - SFTP Profile: Admin Workstation with authorized Ed25519 key`)
}

if (process.argv[1] && process.argv[1].endsWith('seed-demo.mjs')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
