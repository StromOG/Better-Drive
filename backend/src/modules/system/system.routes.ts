import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Busboy from 'busboy'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { requireAdmin, requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { adminSensitiveLimiter } from '../../middleware/rate-limit.middleware.js'
import { decryptText, encryptText } from '../../utils/crypto.js'
import { createAuditLog } from '../../utils/audit.js'
import { serializeJson } from '../../utils/json-column.js'
import { parseBackupFile } from '../../utils/backup-migration.js'

export const systemRouter = Router()

/**
 * Upstream architecture exposed `POST /system/update`, which ran `update.sh`
 * (`git reset --hard` + `git pull` + `npm install` + `pm2 restart`) for any
 * authenticated user. That is remote code execution granted to anyone who can
 * register. It is deliberately not reimplemented here. Updating is an
 * operator action performed on the host:
 *
 *   git pull && docker compose up -d --build
 *
 * Backup, restore and the global OAuth configuration are admin-only below.
 */

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

/**
 * Non-secret facts about this installation, so the web app can describe the
 * server it is actually talking to instead of hardcoding guesses.
 */
systemRouter.get('/config', requireAuth, (_req, res) => {
  return res.json({
    dbProvider: env.DATABASE_PROVIDER,
    maxUploadBytes: String(env.MAX_UPLOAD_BYTES),
    driveRootFolder: env.DRIVE_ROOT_FOLDER,
    registrationOpen: env.ALLOW_REGISTRATION,
    restoreEnabled: env.ALLOW_DB_RESTORE,
    captchaRequired: Boolean(env.RECAPTCHA_SECRET_KEY),
    fileBackupSupported: env.DATABASE_PROVIDER === 'sqlite',
  })
})

systemRouter.get('/google-config', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.providerConfig.findFirst({
      where: { userId: null, provider: 'google_drive', status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    // Derived from configured APP_URL, never from the Host header: a forged
    // Host would otherwise seed an attacker-controlled OAuth redirect URI.
    const defaultRedirectUri = `${env.APP_URL.replace(/\/+$/, '')}/connected-accounts/google/callback`

    if (!config) return res.json({ exists: false, defaultRedirectUri })

    let clientId = ''
    try {
      clientId = decryptText(config.clientIdEncrypted)
    } catch {
      // A TOKEN_ENCRYPTION_KEY change makes stored values unreadable. Report
      // the config as present but empty so the admin can re-enter it.
      clientId = ''
    }

    return res.json({
      exists: true,
      clientId,
      redirectUri: config.redirectUri,
      hasSecret: Boolean(config.clientSecretEncrypted),
      defaultRedirectUri,
    })
  } catch (error) {
    return next(error)
  }
})

const googleConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required.'),
  clientSecret: z.string().optional(),
  redirectUri: z.string().url().optional(),
})

systemRouter.post('/google-config', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const body = googleConfigSchema.parse(req.body)
    const defaultRedirectUri = `${env.APP_URL.replace(/\/+$/, '')}/connected-accounts/google/callback`

    const previous = await prisma.providerConfig.findFirst({
      where: { userId: null, provider: 'google_drive', status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    // Let an admin update the client ID or redirect URI without re-entering
    // the secret, which the UI never shows them.
    let secret = body.clientSecret
    if (!secret && previous) {
      try {
        secret = decryptText(previous.clientSecretEncrypted)
      } catch {
        secret = undefined
      }
    }
    if (!secret) {
      throw HttpError.badRequest(
        'Client Secret is required the first time you save this configuration.',
      )
    }

    const config = await prisma.$transaction(async (tx) => {
      await tx.providerConfig.updateMany({
        where: { userId: null, provider: 'google_drive', status: 'active' },
        data: { status: 'disabled' },
      })
      return tx.providerConfig.create({
        data: {
          userId: null,
          provider: 'google_drive',
          clientIdEncrypted: encryptText(body.clientId),
          clientSecretEncrypted: encryptText(secret),
          redirectUri: body.redirectUri ?? previous?.redirectUri ?? defaultRedirectUri,
          scopes: serializeJson(GOOGLE_SCOPES),
          status: 'active',
        },
      })
    })

    await createAuditLog(req.user!.id, 'system.google_config.updated', 'provider_config', config.id, {
      ip: req.ip,
    })

    return res.status(201).json({
      status: 'success',
      message: 'Google OAuth configuration saved.',
      id: config.id,
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * Resolves the SQLite file backing this installation.
 *
 * Only meaningful for the SQLite provider. MySQL and Postgres are backed up
 * with their own tooling, which this process has no business shelling out to.
 */
function sqliteFilePath(): string {
  if (env.DATABASE_PROVIDER !== 'sqlite') {
    throw HttpError.badRequest(
      `File-based backup is only available on SQLite. This installation uses ${env.DATABASE_PROVIDER}; use mysqldump or pg_dump instead.`,
      'BACKUP_UNSUPPORTED_PROVIDER',
    )
  }

  const rawUrl = env.DATABASE_URL.replace(/^(sqlite|file):/, '').split('?')[0]
  if (path.isAbsolute(rawUrl)) {
    return rawUrl
  }

  const candidates = [
    path.resolve(process.cwd(), 'prisma', rawUrl),
    path.resolve(process.cwd(), rawUrl),
    path.resolve(process.cwd(), 'backend', 'prisma', rawUrl),
    path.resolve(__dirname, '../../..', 'prisma', rawUrl.replace(/^\.?\/?(prisma\/)?/, '')),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0]
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Returns database statistics and backup telemetry.
 */
systemRouter.get(
  '/backup/stats',
  requireAuth,
  requireAdmin,
  async (_req: AuthRequest, res, next) => {
    try {
      let databaseSizeBytes = 0
      let walSizeBytes = 0
      let walActive = false
      let lastModified = new Date().toISOString()

      if (env.DATABASE_PROVIDER === 'sqlite') {
        const dbPath = sqliteFilePath()
        if (fs.existsSync(dbPath)) {
          const stat = fs.statSync(dbPath)
          databaseSizeBytes = stat.size
          lastModified = stat.mtime.toISOString()
        }
        if (fs.existsSync(`${dbPath}-wal`)) {
          walActive = true
          walSizeBytes = fs.statSync(`${dbPath}-wal`).size
        }
      }

      const [users, files, folders, connectedAccounts, sftpProfiles, sftpKeys, auditLogs, lastBackup] =
        await Promise.all([
          prisma.user.count(),
          prisma.file.count({ where: { deletedAt: null } }),
          prisma.folder.count(),
          prisma.connectedAccount.count(),
          prisma.sftpAccessProfile.count(),
          prisma.sftpAuthorizedKey.count().catch(() => 0),
          prisma.auditLog.count(),
          prisma.auditLog.findFirst({
            where: { action: 'system.backup.downloaded' },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ])

      return res.json({
        success: true,
        dbType: env.DATABASE_PROVIDER,
        databaseProvider: env.DATABASE_PROVIDER,
        sizeBytes: databaseSizeBytes,
        databaseSizeBytes,
        formattedSize: formatBytes(databaseSizeBytes),
        walActive,
        walSizeBytes,
        walFormattedSize: formatBytes(walSizeBytes),
        lastModified,
        fileBackupSupported: env.DATABASE_PROVIDER === 'sqlite',
        restoreEnabled: env.ALLOW_DB_RESTORE || env.NODE_ENV === 'development',
        backupSafety: true,
        counts: {
          users,
          files,
          folders,
          connectedAccounts,
          accounts: connectedAccounts,
          sftpProfiles,
          sftpKeys,
          auditLogs,
        },
        lastBackupAt: lastBackup?.createdAt ?? null,
      })
    } catch (error) {
      return next(error)
    }
  },
)

systemRouter.get(
  '/backup',
  requireAuth,
  requireAdmin,
  adminSensitiveLimiter,
  async (req: AuthRequest, res, next) => {
    try {
      const format =
        (req.query.format as string) || (env.DATABASE_PROVIDER === 'sqlite' ? 'db' : 'json')

      await createAuditLog(req.user!.id, 'system.backup.downloaded', 'system', undefined, {
        ip: req.ip,
        format,
      })

      const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')

      // JSON Universal Archive (Works across SQLite, MySQL, and Postgres)
      if (format === 'json') {
        const [
          users,
          connectedAccounts,
          folders,
          files,
          fileShares,
          sftpAccessProfiles,
          sftpAuthorizedKeys,
          sftpSessionLogs,
          providerConfigs,
          savedViews,
          auditLogs,
        ] = await Promise.all([
          prisma.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              passwordHash: true,
              role: true,
              status: true,
              gravatarEnabled: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          prisma.connectedAccount.findMany(),
          prisma.folder.findMany(),
          prisma.file.findMany(),
          prisma.fileShare.findMany(),
          prisma.sftpAccessProfile.findMany(),
          prisma.sftpAuthorizedKey.findMany(),
          prisma.sftpSessionLog.findMany({ take: 200, orderBy: { createdAt: 'desc' } }),
          prisma.providerConfig.findMany(),
          prisma.savedView.findMany(),
          prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
        ])

        const archive = {
          betterDriveBackupVersion: '1.0',
          exportedAt: new Date().toISOString(),
          databaseProvider: env.DATABASE_PROVIDER,
          counts: {
            users: users.length,
            connectedAccounts: connectedAccounts.length,
            folders: folders.length,
            files: files.length,
            fileShares: fileShares.length,
            sftpAccessProfiles: sftpAccessProfiles.length,
            auditLogs: auditLogs.length,
          },
          data: {
            users,
            connectedAccounts,
            folders,
            files,
            fileShares,
            sftpAccessProfiles,
            sftpAuthorizedKeys,
            sftpSessionLogs,
            providerConfigs,
            savedViews,
            auditLogs,
          },
        }

        const jsonBuffer = Buffer.from(JSON.stringify(archive, null, 2), 'utf-8')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="better-drive-archive-${stamp}.json"`,
        )
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        return res.send(jsonBuffer)
      }

      // SQLite Raw Database Snapshot (.db)
      const dbPath = sqliteFilePath()
      if (!fs.existsSync(dbPath)) throw HttpError.notFound('Database file not found.')

      // Flush WAL to disk first for 100% data consistency
      try {
        await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);')
      } catch {
        // checkpoint best effort
      }

      res.setHeader('Content-Disposition', `attachment; filename="better-drive-${stamp}.db"`)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return fs.createReadStream(dbPath).pipe(res)
    } catch (error) {
      return next(error)
    }
  },
)

systemRouter.post(
  '/restore',
  requireAuth,
  requireAdmin,
  adminSensitiveLimiter,
  async (req: AuthRequest, res, next) => {
    try {
      const isRestoreAllowed = env.ALLOW_DB_RESTORE || env.NODE_ENV === 'development'
      if (!isRestoreAllowed) {
        throw HttpError.forbidden(
          'Database restore is disabled. Set ALLOW_DB_RESTORE=true in .env to enable it.',
          'RESTORE_DISABLED',
        )
      }
      if (req.header('X-Confirm-Restore') !== 'replace-all-data') {
        throw HttpError.badRequest(
          'Restore requires the header X-Confirm-Restore: replace-all-data.',
          'RESTORE_NOT_CONFIRMED',
        )
      }
      if (!req.headers['content-type']?.includes('multipart/form-data')) {
        throw HttpError.badRequest('multipart/form-data required.')
      }

      const backupDir = path.resolve(process.cwd(), 'data', 'backups')
      await fs.promises.mkdir(backupDir, { recursive: true })

      const tempPath = path.join(backupDir, `temp-upload-${Date.now()}`)
      const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 2 * 1024 ** 3 } })
      let received = false
      let originalFilename = ''

      const cleanup = () => {
        try {
          fs.rmSync(tempPath, { force: true })
        } catch {
          // Best effort
        }
      }

      busboy.on('file', (_name, stream, info) => {
        received = true
        originalFilename = info && info.filename ? info.filename : ''
        const target = fs.createWriteStream(tempPath)
        stream.pipe(target)

        stream.on('limit', () => {
          cleanup()
          if (!res.headersSent) {
            res.status(413).json({ code: 'FILE_TOO_LARGE', message: 'Backup file is too large.' })
          }
        })

        target.on('finish', async () => {
          try {
            const fileStat = await fs.promises.stat(tempPath)
            if (fileStat.size === 0) {
              cleanup()
              throw HttpError.badRequest('The uploaded backup file is empty.')
            }

            let parseResult
            try {
              parseResult = await parseBackupFile(tempPath, originalFilename)
            } catch (err: any) {
              cleanup()
              throw HttpError.badRequest(err.message || 'Failed to parse backup file.', 'RESTORE_INVALID_FILE')
            }

            const { isSqlite, archive } = parseResult

            // 1. Normalized Archive Restore (Better Drive JSON, 9Drive JSON, 9Drive SQL dump, or 9Drive .env)
            if (!isSqlite && archive) {
              const data = archive.data

              // Pre-restore safety snapshot
              const safetySnapshotPath = path.join(backupDir, `safety-snapshot-${Date.now()}.json`)
              try {
                const [currentUsers, currentFiles, currentConfigs] = await Promise.all([
                  prisma.user.findMany(),
                  prisma.file.findMany(),
                  prisma.providerConfig.findMany(),
                ])
                await fs.promises.writeFile(
                  safetySnapshotPath,
                  JSON.stringify(
                    {
                      date: new Date().toISOString(),
                      users: currentUsers,
                      files: currentFiles,
                      providerConfigs: currentConfigs,
                    },
                    null,
                    2,
                  ),
                  'utf-8',
                )
              } catch {
                // best effort
              }

              // Restore Provider Configs (Google OAuth credentials from 9Drive settings or archive)
              if (Array.isArray(data.providerConfigs) && data.providerConfigs.length > 0) {
                for (const pc of data.providerConfigs) {
                  if (pc.provider === 'google_drive' && pc.clientIdEncrypted && pc.clientSecretEncrypted) {
                    await prisma.$transaction(async (tx) => {
                      await tx.providerConfig.updateMany({
                        where: { userId: null, provider: 'google_drive', status: 'active' },
                        data: { status: 'disabled' },
                      })
                      await tx.providerConfig.create({
                        data: {
                          userId: pc.userId ?? null,
                          provider: 'google_drive',
                          clientIdEncrypted: pc.clientIdEncrypted,
                          clientSecretEncrypted: pc.clientSecretEncrypted,
                          redirectUri: pc.redirectUri || `${env.APP_URL.replace(/\/+$/, '')}/connected-accounts/google/callback`,
                          scopes: pc.scopes || serializeJson(GOOGLE_SCOPES),
                          status: 'active',
                        },
                      })
                    })
                  }
                }
              }

              // Restore users
              if (Array.isArray(data.users) && data.users.length > 0) {
                for (const u of data.users) {
                  await prisma.user.upsert({
                    where: { email: u.email },
                    update: {
                      name: u.name,
                      passwordHash: u.passwordHash,
                      role: u.role || 'member',
                      status: u.status || 'active',
                    },
                    create: {
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      passwordHash: u.passwordHash,
                      role: u.role || 'member',
                      status: u.status || 'active',
                    },
                  })
                }
              }

              // Get active Google config if available to link orphan 9Drive accounts
              const activeGoogleConfig = await prisma.providerConfig.findFirst({
                where: { userId: null, provider: 'google_drive', status: 'active' },
                orderBy: { createdAt: 'desc' },
              })

              // Restore connected accounts
              if (Array.isArray(data.connectedAccounts) && data.connectedAccounts.length > 0) {
                for (const acc of data.connectedAccounts) {
                  const accId = acc.id || crypto.randomUUID()
                  await prisma.connectedAccount.upsert({
                    where: { id: accId },
                    update: {
                      email: acc.email,
                      displayName: acc.displayName,
                      status: acc.status || 'connected',
                    },
                    create: {
                      id: accId,
                      userId: acc.userId,
                      providerConfigId: acc.provider === 'google_drive' ? activeGoogleConfig?.id : null,
                      provider: acc.provider || 'google_drive',
                      providerAccountId: acc.providerAccountId || accId,
                      email: acc.email,
                      displayName: acc.displayName,
                      scopes: acc.scopes || '',
                      status: acc.status || 'connected',
                      accessTokenEncrypted: acc.accessTokenEncrypted,
                      refreshTokenEncrypted: acc.refreshTokenEncrypted,
                    },
                  })

                  try {
                    await prisma.storageAccount.upsert({
                      where: { connectedAccountId: accId },
                      update: {},
                      create: { connectedAccountId: accId, usedBytes: 0n },
                    })
                  } catch {
                    // best effort
                  }
                }
              }

              // Restore folders
              if (Array.isArray(data.folders) && data.folders.length > 0) {
                for (const f of data.folders) {
                  const folderId = f.id || crypto.randomUUID()
                  await prisma.folder.upsert({
                    where: { id: folderId },
                    update: { name: f.name, color: f.color },
                    create: {
                      id: folderId,
                      userId: f.userId,
                      parentId: f.parentId,
                      name: f.name,
                      color: f.color,
                    },
                  })
                }
              }

              // Restore files
              if (Array.isArray(data.files) && data.files.length > 0) {
                for (const file of data.files) {
                  const fileId = file.id || crypto.randomUUID()
                  const providerFileId = file.providerFileId || fileId
                  await prisma.file.upsert({
                    where: { id: fileId },
                    update: {
                      name: file.name,
                      mimeType: file.mimeType,
                      sizeBytes: BigInt(file.sizeBytes || 0),
                      starred: file.starred || false,
                      deletedAt: file.deletedAt ? new Date(file.deletedAt) : null,
                    },
                    create: {
                      id: fileId,
                      userId: file.userId,
                      connectedAccountId: file.connectedAccountId,
                      folderId: file.folderId || null,
                      provider: file.provider || 'google_drive',
                      providerFileId,
                      name: file.name,
                      mimeType: file.mimeType,
                      sizeBytes: BigInt(file.sizeBytes || 0),
                      checksum: file.checksum || null,
                      starred: file.starred || false,
                      deletedAt: file.deletedAt ? new Date(file.deletedAt) : null,
                    },
                  })
                }
              }

              // Restore SFTP Access Profiles (if present)
              if (Array.isArray((data as any).sftpAccessProfiles) && (data as any).sftpAccessProfiles.length > 0) {
                for (const sftp of (data as any).sftpAccessProfiles) {
                  await prisma.sftpAccessProfile.upsert({
                    where: { id: sftp.id },
                    update: {
                      label: sftp.label,
                      allowRead: sftp.allowRead ?? true,
                      allowWrite: sftp.allowWrite ?? false,
                      allowDelete: sftp.allowDelete ?? false,
                      allowedRoots: sftp.allowedRoots ?? '[]',
                      enabled: sftp.enabled ?? true,
                    },
                    create: {
                      id: sftp.id,
                      userId: sftp.userId,
                      label: sftp.label,
                      allowRead: sftp.allowRead ?? true,
                      allowWrite: sftp.allowWrite ?? false,
                      allowDelete: sftp.allowDelete ?? false,
                      allowedRoots: sftp.allowedRoots ?? '[]',
                      enabled: sftp.enabled ?? true,
                    },
                  })
                }
              }

              // Restore SFTP Authorized Keys (if present)
              if (Array.isArray((data as any).sftpAuthorizedKeys) && (data as any).sftpAuthorizedKeys.length > 0) {
                for (const key of (data as any).sftpAuthorizedKeys) {
                  await prisma.sftpAuthorizedKey.upsert({
                    where: { id: key.id },
                    update: {
                      label: key.label,
                      publicKey: key.publicKey,
                    },
                    create: {
                      id: key.id,
                      profileId: key.profileId,
                      label: key.label,
                      publicKey: key.publicKey,
                      fingerprint: key.fingerprint,
                    },
                  })
                }
              }

              cleanup()

              await createAuditLog(req.user!.id, 'system.restore.applied', 'system', undefined, {
                ip: req.ip,
                format: archive.source,
              })

              let successMessage = 'Universal archive restored successfully.'
              if (archive.source === '9drive') {
                successMessage = '9Drive backup migrated successfully! Settings, storage accounts, folders, and files are ready.'
              } else if (archive.source === 'sql') {
                successMessage = '9Drive SQL database dump restored successfully! Users, storage accounts, and file indexes imported.'
              } else if (archive.source === 'env') {
                successMessage = '9Drive .env settings imported successfully! Google OAuth client credentials updated.'
              }

              return res.json({
                status: 'success',
                message: successMessage,
                format: archive.source,
                safetyBackup: path.basename(safetySnapshotPath),
                counts: archive.counts,
              })
            }

            // 2. SQLite Database Binary Restore (.db)
            const dbPath = sqliteFilePath()

            // Create pre-restore safety copy of the current SQLite database
            const safetyDbPath = path.join(backupDir, `safety-snapshot-${Date.now()}.db`)
            try {
              if (fs.existsSync(dbPath)) {
                await fs.promises.copyFile(dbPath, safetyDbPath)
              }
            } catch {
              // best effort
            }

            await createAuditLog(req.user!.id, 'system.restore.applied', 'system', undefined, {
              ip: req.ip,
              format: 'sqlite',
            })

            // Disconnect Prisma client so file locks are released
            await prisma.$disconnect()

            // Remove existing WAL and SHM files to prevent corruption with restored pages
            try {
              fs.rmSync(`${dbPath}-wal`, { force: true })
              fs.rmSync(`${dbPath}-shm`, { force: true })
            } catch {
              // ignore
            }

            // Safe copy to destination
            try {
              await fs.promises.copyFile(tempPath, dbPath)
            } catch {
              fs.copyFileSync(tempPath, dbPath)
            }
            cleanup()

            res.json({
              status: 'success',
              message:
                'Database restored. The server is restarting to reload all storage pools.',
              format: 'sqlite',
              safetyBackup: path.basename(safetyDbPath),
            })

            setTimeout(() => process.exit(0), 1000)
          } catch (error) {
            cleanup()
            if (!res.headersSent) next(error)
          }
        })

        target.on('error', (error) => {
          cleanup()
          if (!res.headersSent) next(error)
        })
      })

      busboy.on('error', (error) => {
        cleanup()
        if (!res.headersSent) next(error)
      })

      busboy.on('close', () => {
        if (!received && !res.headersSent) {
          res.status(400).json({ code: 'BAD_REQUEST', message: 'No file uploaded.' })
        }
      })

      return req.pipe(busboy)
    } catch (error) {
      return next(error)
    }
  },
)
