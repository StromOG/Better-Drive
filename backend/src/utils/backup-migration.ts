import crypto from 'node:crypto'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { decryptText, encryptText } from './crypto.js'
import { serializeJson } from './json-column.js'

export interface NormalizedBackupData {
  users?: Array<{
    id?: string
    name: string
    email: string
    passwordHash: string
    role?: string
    status?: string
    gravatarEnabled?: boolean
  }>
  connectedAccounts?: Array<{
    id?: string
    userId: string
    provider?: string
    providerAccountId?: string
    email: string
    displayName?: string | null
    avatarUrl?: string | null
    accessTokenEncrypted?: string | null
    refreshTokenEncrypted?: string | null
    tokenExpiresAt?: Date | string | null
    scopes?: string
    status?: string
  }>
  folders?: Array<{
    id?: string
    userId: string
    parentId?: string | null
    connectedAccountId?: string | null
    provider?: string
    providerFolderId?: string | null
    name: string
    color?: string
  }>
  files?: Array<{
    id?: string
    userId: string
    connectedAccountId: string
    folderId?: string | null
    provider?: string
    providerFileId?: string
    name: string
    mimeType: string
    sizeBytes: bigint | number | string
    checksum?: string | null
    starred?: boolean
    deletedAt?: Date | string | null
  }>
  providerConfigs?: Array<{
    id?: string
    userId?: string | null
    provider: string
    clientIdEncrypted: string
    clientSecretEncrypted: string
    redirectUri: string
    scopes: string
    status?: string
  }>
}

export interface NormalizedBackup {
  source: 'better-drive' | '9drive' | 'sql' | 'env'
  settings?: {
    googleClientId?: string
    googleClientSecret?: string
    redirectUri?: string
    driveRootFolder?: string
    tokenEncryptionKey?: string
  }
  data: NormalizedBackupData
  counts: {
    users: number
    connectedAccounts: number
    folders: number
    files: number
    providerConfigs: number
  }
}

/**
 * Normalizes 9Drive folder colors like 'text-blue-500' to Better Drive standard color keys ('blue').
 */
export function normalizeFolderColor(color: unknown): string {
  if (typeof color !== 'string' || !color) return 'blue'
  const normalized = color.replace(/^text-/, '').replace(/-\d+$/, '').trim().toLowerCase()
  const allowed = ['blue', 'indigo', 'emerald', 'green', 'amber', 'rose', 'pink', 'purple', 'slate']
  return allowed.includes(normalized) ? normalized : 'blue'
}

/**
 * Decrypts with a specific AES-256-GCM key string (e.g. 9Drive's TOKEN_ENCRYPTION_KEY).
 */
export function decryptWithCustomKey(ciphertext: string, keyString: string): string | null {
  try {
    const key = crypto.createHash('sha256').update(keyString).digest()
    const [ivRaw, tagRaw, encryptedRaw] = ciphertext.split(':')
    if (!ivRaw || !tagRaw || !encryptedRaw) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'))
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/**
 * Ensures tokens and secrets are stored in active Better Drive AES-256-GCM format.
 * If encrypted with a legacy 9Drive key, it re-encrypts with the current active key.
 */
export function normalizeAndEncrypt(value: string | null | undefined, customKey?: string): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // If already standard 3-part base64 payload
  const parts = trimmed.split(':')
  if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9+/=]+$/.test(p) && p.length > 0)) {
    try {
      decryptText(trimmed)
      return trimmed // Already correctly encrypted with active Better Drive key
    } catch {
      // Encrypted with legacy 9Drive key
      if (customKey) {
        const decrypted = decryptWithCustomKey(trimmed, customKey)
        if (decrypted) {
          return encryptText(decrypted)
        }
      }
    }
  }

  // Plaintext value (e.g. raw refresh token or client secret)
  try {
    return encryptText(trimmed)
  } catch {
    return null
  }
}

/**
 * Parses a .env configuration file (from 9Drive or Better Drive).
 */
export function parseEnvBackup(content: string): NormalizedBackup {
  const lines = content.split(/\r?\n/)
  const vars: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      vars[key] = val
    }
  }

  const googleClientId = vars.GOOGLE_CLIENT_ID || vars.CLIENT_ID || vars.GOOGLE_DRIVE_CLIENT_ID
  const googleClientSecret = vars.GOOGLE_CLIENT_SECRET || vars.CLIENT_SECRET || vars.GOOGLE_DRIVE_CLIENT_SECRET
  const redirectUri = vars.GOOGLE_REDIRECT_URI || vars.REDIRECT_URI || 'http://localhost:4000/connected-accounts/google/callback'
  const driveRootFolder = vars.DRIVE_ROOT_FOLDER || '9drive'
  const tokenEncryptionKey = vars.TOKEN_ENCRYPTION_KEY

  const providerConfigs: NormalizedBackupData['providerConfigs'] = []
  if (googleClientId && googleClientSecret) {
    providerConfigs.push({
      provider: 'google_drive',
      clientIdEncrypted: encryptText(googleClientId),
      clientSecretEncrypted: encryptText(googleClientSecret),
      redirectUri,
      scopes: serializeJson([
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]),
      status: 'active',
    })
  }

  return {
    source: 'env',
    settings: {
      googleClientId,
      googleClientSecret,
      redirectUri,
      driveRootFolder,
      tokenEncryptionKey,
    },
    data: {
      users: [],
      connectedAccounts: [],
      folders: [],
      files: [],
      providerConfigs,
    },
    counts: {
      users: 0,
      connectedAccounts: 0,
      folders: 0,
      files: 0,
      providerConfigs: providerConfigs.length,
    },
  }
}

/**
 * Parses and normalizes any JSON archive (Better Drive format or 9Drive dump).
 */
export function parseJsonBackup(parsed: any, tokenEncryptionKey?: string): NormalizedBackup {
  const root = parsed.data || parsed
  const is9Drive =
    parsed.source === '9drive' ||
    Boolean(parsed['9driveVersion']) ||
    Boolean(root.accounts && !root.connectedAccounts) ||
    Boolean(parsed.settings?.driveRootFolder)

  const legacyKey = tokenEncryptionKey || parsed.settings?.tokenEncryptionKey

  const rawUsers = root.users || root.user || []
  const rawAccounts = root.connectedAccounts || root.connected_accounts || root.accounts || []
  const rawFolders = root.folders || root.folder || []
  const rawFiles = root.files || root.file || []
  const rawConfigs = root.providerConfigs || root.provider_configs || root.google_configs || []

  // Normalize Users (ensure first user is owner if no role was specified in 9Drive)
  const users: NonNullable<NormalizedBackupData['users']> = Array.isArray(rawUsers)
    ? rawUsers.map((u: any, idx: number) => ({
        id: u.id || crypto.randomUUID(),
        name: u.name || 'User',
        email: u.email,
        passwordHash: u.passwordHash || u.password_hash || u.password || '',
        role: u.role || (idx === 0 ? 'owner' : 'member'),
        status: u.status || 'active',
        gravatarEnabled: Boolean(u.gravatarEnabled ?? u.gravatar_enabled ?? false),
      })).filter((u) => Boolean(u.email))
    : []

  // Normalize Connected Accounts (Google Drive / S3)
  const connectedAccounts: NonNullable<NormalizedBackupData['connectedAccounts']> = Array.isArray(rawAccounts)
    ? rawAccounts.map((acc: any) => {
        const rawRefreshToken = acc.refreshToken || acc.refresh_token || acc.refreshTokenEncrypted || acc.refresh_token_encrypted
        const rawAccessToken = acc.accessToken || acc.access_token || acc.accessTokenEncrypted || acc.access_token_encrypted
        const accId = acc.id || crypto.randomUUID()
        const rawScopes = acc.scopes
        const scopes = typeof rawScopes === 'string'
          ? (rawScopes.startsWith('[') ? rawScopes : serializeJson([rawScopes]))
          : serializeJson(rawScopes || [
              'https://www.googleapis.com/auth/drive',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
            ])

        return {
          id: accId,
          userId: acc.userId || acc.user_id,
          provider: acc.provider || 'google_drive',
          providerAccountId: acc.providerAccountId || acc.provider_account_id || accId,
          email: acc.email || '',
          displayName: acc.displayName || acc.display_name || null,
          avatarUrl: acc.avatarUrl || acc.avatar_url || null,
          accessTokenEncrypted: normalizeAndEncrypt(rawAccessToken, legacyKey),
          refreshTokenEncrypted: normalizeAndEncrypt(rawRefreshToken, legacyKey),
          tokenExpiresAt: acc.tokenExpiresAt || acc.token_expires_at || null,
          scopes,
          status: acc.status || 'connected',
        }
      }).filter((acc) => Boolean(acc.userId && acc.email))
    : []

  // Normalize Folders
  const folders: NonNullable<NormalizedBackupData['folders']> = Array.isArray(rawFolders)
    ? rawFolders.map((f: any) => ({
        id: f.id || crypto.randomUUID(),
        userId: f.userId || f.user_id,
        parentId: f.parentId || f.parent_id || null,
        connectedAccountId: f.connectedAccountId || f.connected_account_id || null,
        provider: f.provider || 'google_drive',
        providerFolderId: f.providerFolderId || f.provider_folder_id || null,
        name: f.name || 'Untitled Folder',
        color: normalizeFolderColor(f.color),
      })).filter((f) => Boolean(f.userId && f.name))
    : []

  // Normalize Files
  const files: NonNullable<NormalizedBackupData['files']> = Array.isArray(rawFiles)
    ? rawFiles.map((file: any) => {
        const fileId = file.id || crypto.randomUUID()
        return {
          id: fileId,
          userId: file.userId || file.user_id,
          connectedAccountId: file.connectedAccountId || file.connected_account_id || file.accountId || file.account_id || '',
          folderId: file.folderId || file.folder_id || null,
          provider: file.provider || 'google_drive',
          providerFileId: file.providerFileId || file.provider_file_id || fileId,
          name: file.name || 'Untitled',
          mimeType: file.mimeType || file.mime_type || 'application/octet-stream',
          sizeBytes: file.sizeBytes || file.size_bytes || file.size || 0,
          checksum: file.checksum || null,
          starred: Boolean(file.starred || file.is_starred || false),
          deletedAt: file.deletedAt || file.deleted_at || null,
        }
      }).filter((f) => Boolean(f.userId && f.name))
    : []

  // Normalize Provider Configs (Google OAuth credentials)
  const providerConfigs: NonNullable<NormalizedBackupData['providerConfigs']> = []

  const settings = parsed.settings || root.settings || {}
  const googleClientId = settings.googleClientId || settings.google_client_id || settings.clientId
  const googleClientSecret = settings.googleClientSecret || settings.google_client_secret || settings.clientSecret
  if (googleClientId && googleClientSecret) {
    providerConfigs.push({
      provider: 'google_drive',
      clientIdEncrypted: normalizeAndEncrypt(googleClientId, legacyKey)!,
      clientSecretEncrypted: normalizeAndEncrypt(googleClientSecret, legacyKey)!,
      redirectUri: settings.redirectUri || settings.redirect_uri || 'http://localhost:4000/connected-accounts/google/callback',
      scopes: serializeJson([
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]),
      status: 'active',
    })
  }

  if (Array.isArray(rawConfigs)) {
    for (const c of rawConfigs) {
      const cId = c.clientId || c.client_id || c.clientIdEncrypted || c.client_id_encrypted
      const cSec = c.clientSecret || c.client_secret || c.clientSecretEncrypted || c.client_secret_encrypted
      if (cId && cSec) {
        providerConfigs.push({
          id: c.id,
          userId: c.userId || c.user_id || null,
          provider: c.provider || 'google_drive',
          clientIdEncrypted: normalizeAndEncrypt(cId, legacyKey)!,
          clientSecretEncrypted: normalizeAndEncrypt(cSec, legacyKey)!,
          redirectUri: c.redirectUri || c.redirect_uri || 'http://localhost:4000/connected-accounts/google/callback',
          scopes: typeof c.scopes === 'string' ? c.scopes : serializeJson(c.scopes || []),
          status: c.status || 'active',
        })
      }
    }
  }

  return {
    source: is9Drive ? '9drive' : 'better-drive',
    settings: {
      googleClientId,
      googleClientSecret,
      redirectUri: settings.redirectUri || settings.redirect_uri,
      driveRootFolder: settings.driveRootFolder || settings.drive_root_folder,
      tokenEncryptionKey: legacyKey,
    },
    data: {
      users,
      connectedAccounts,
      folders,
      files,
      providerConfigs,
    },
    counts: {
      users: users.length,
      connectedAccounts: connectedAccounts.length,
      folders: folders.length,
      files: files.length,
      providerConfigs: providerConfigs.length,
    },
  }
}

/**
 * Parses raw MySQL or SQLite SQL dump lines into rows.
 */
function parseSqlRows(sqlText: string, tableName: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  const insertRegex = new RegExp(
    `INSERT\\s+INTO\\s+[\`"]?${tableName}[\`"]?\\s*(?:\\(([^)]+)\\))?\\s*VALUES\\s*([\\s\\S]+?);(?:\\r?\\n|$)`,
    'gi',
  )

  let match: RegExpExecArray | null
  while ((match = insertRegex.exec(sqlText)) !== null) {
    const columnsPart = match[1]
    const valuesPart = match[2]

    let explicitColumns: string[] | null = null
    if (columnsPart) {
      explicitColumns = columnsPart
        .split(',')
        .map((c) => c.trim().replace(/^[`"']|[`"']$/g, ''))
    }

    let inParen = false
    let inString = false
    let quoteChar = ''
    let currentVal = ''
    let currentRow: string[] = []

    for (let i = 0; i < valuesPart.length; i++) {
      const char = valuesPart[i]
      const nextChar = valuesPart[i + 1]

      if (char === '(' && !inString && !inParen) {
        inParen = true
        currentRow = []
        currentVal = ''
        continue
      }

      if (inParen) {
        if (inString) {
          if (char === '\\') {
            currentVal += nextChar || ''
            i++
            continue
          }
          if (char === quoteChar) {
            if (nextChar === quoteChar) {
              currentVal += quoteChar
              i++
              continue
            }
            inString = false
            continue
          }
          currentVal += char
        } else {
          if (char === "'" || char === '"' || char === '`') {
            inString = true
            quoteChar = char
          } else if (char === ',') {
            currentRow.push(currentVal.trim())
            currentVal = ''
          } else if (char === ')') {
            currentRow.push(currentVal.trim())
            currentVal = ''
            inParen = false

            const record: Record<string, string> = {}
            if (explicitColumns) {
              for (let colIdx = 0; colIdx < explicitColumns.length; colIdx++) {
                record[explicitColumns[colIdx]] = unwrapSqlValue(currentRow[colIdx] || '')
              }
            } else {
              for (let colIdx = 0; colIdx < currentRow.length; colIdx++) {
                record[`col_${colIdx}`] = unwrapSqlValue(currentRow[colIdx] || '')
              }
            }
            rows.push(record)
          } else {
            currentVal += char
          }
        }
      }
    }
  }

  return rows
}

function unwrapSqlValue(val: string): string {
  const trimmed = val.trim()
  if (trimmed.toUpperCase() === 'NULL') return ''
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * Parses a 9Drive MySQL or SQLite database SQL dump (.sql).
 */
export function parseSqlDump(sqlText: string, tokenEncryptionKey?: string): NormalizedBackup {
  const userRows = parseSqlRows(sqlText, 'users').concat(parseSqlRows(sqlText, 'user'))
  const accountRows = parseSqlRows(sqlText, 'connected_accounts')
    .concat(parseSqlRows(sqlText, 'accounts'))
    .concat(parseSqlRows(sqlText, 'account'))
  const folderRows = parseSqlRows(sqlText, 'folders').concat(parseSqlRows(sqlText, 'folder'))
  const fileRows = parseSqlRows(sqlText, 'files').concat(parseSqlRows(sqlText, 'file'))
  const configRows = parseSqlRows(sqlText, 'provider_configs')
    .concat(parseSqlRows(sqlText, 'provider_config'))
    .concat(parseSqlRows(sqlText, 'settings'))

  return parseJsonBackup(
    {
      source: '9drive',
      data: {
        users: userRows,
        connectedAccounts: accountRows,
        folders: folderRows,
        files: fileRows,
        providerConfigs: configRows,
      },
    },
    tokenEncryptionKey,
  )
}

/**
 * Parses a 9Drive SQLite database (.db) using node:sqlite DatabaseSync.
 */
export function parseSqliteBackup(filePath: string, tokenEncryptionKey?: string): NormalizedBackup {
  const db = new DatabaseSync(filePath, { readOnly: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    const tableNames = new Set(tables.map((t) => t.name))

    const rawUsers = tableNames.has('users') ? (db.prepare('SELECT * FROM users').all() as any[]) : []
    const rawAccounts = tableNames.has('connected_accounts')
      ? (db.prepare('SELECT * FROM connected_accounts').all() as any[])
      : tableNames.has('accounts')
      ? (db.prepare('SELECT * FROM accounts').all() as any[])
      : []
    const rawFolders = tableNames.has('folders') ? (db.prepare('SELECT * FROM folders').all() as any[]) : []
    const rawFiles = tableNames.has('files') ? (db.prepare('SELECT * FROM files').all() as any[]) : []
    const rawConfigs = tableNames.has('provider_configs') ? (db.prepare('SELECT * FROM provider_configs').all() as any[]) : []

    return parseJsonBackup(
      {
        source: '9drive',
        data: {
          users: rawUsers,
          connectedAccounts: rawAccounts,
          folders: rawFolders,
          files: rawFiles,
          providerConfigs: rawConfigs,
        },
      },
      tokenEncryptionKey,
    )
  } finally {
    db.close()
  }
}

/**
 * Autodetects file format (SQLite, JSON, SQL, or .env) and returns normalized records.
 */
export async function parseBackupFile(filePath: string, originalFilename = ''): Promise<{
  isSqlite: boolean
  archive: NormalizedBackup | null
}> {
  const header = Buffer.alloc(32)
  const handle = await fs.promises.open(filePath, 'r')
  await handle.read(header, 0, 32, 0)
  await handle.close()

  const headerStr = header.toString('utf8')

  // 1. SQLite Database (.db, 9drive-backup.db)
  if (headerStr.startsWith('SQLite format 3') || originalFilename.endsWith('.db')) {
    try {
      const archive = parseSqliteBackup(filePath)
      // If we extracted records from SQLite, treat as normalized archive
      if (archive.counts.users > 0 || archive.counts.files > 0 || archive.counts.connectedAccounts > 0) {
        return { isSqlite: false, archive }
      }
    } catch {
      // Fallback to binary SQLite snapshot copy
    }
    return { isSqlite: true, archive: null }
  }

  const fileContent = await fs.promises.readFile(filePath, 'utf8')
  const trimmed = fileContent.trim()

  // 2. JSON Universal Archive
  if (trimmed.startsWith('{') || originalFilename.endsWith('.json')) {
    const rawObj = JSON.parse(trimmed)
    return { isSqlite: false, archive: parseJsonBackup(rawObj) }
  }

  // 3. SQL Dump
  if (
    originalFilename.endsWith('.sql') ||
    trimmed.startsWith('--') ||
    trimmed.startsWith('/*') ||
    /INSERT\s+INTO/i.test(trimmed) ||
    /CREATE\s+TABLE/i.test(trimmed)
  ) {
    return { isSqlite: false, archive: parseSqlDump(fileContent) }
  }

  // 4. .env Settings configuration
  if (originalFilename.endsWith('.env') || originalFilename === '.env' || (trimmed.includes('=') && !trimmed.includes('{'))) {
    return { isSqlite: false, archive: parseEnvBackup(fileContent) }
  }

  throw new Error(
    'Unrecognized backup format. Please supply a SQLite .db, Better Drive/9Drive .json archive, 9Drive .sql dump, or 9Drive .env settings file.',
  )
}
