import path from 'node:path'
import { SftpError, SftpErrorCode } from './errors.js'

export type VfsTargetType =
  | 'root'
  | 'pool_root'
  | 'drive_root'
  | 's3_root'
  | 'account_root'
  | 'node' // file or directory inside an account or pool

export interface VfsResolvedTarget {
  type: VfsTargetType
  normalizedPath: string
  accountId?: string
  accountLabel?: string
  provider?: 'google_drive' | 's3' | 'mock'
  isPool?: boolean
  subPath?: string // relative path within target account or pool
}

export interface VfsAccountMapping {
  id: string
  label: string
  provider: 'google_drive' | 's3' | 'mock'
}

/**
 * Sanitizes and normalizes an incoming SFTP path.
 * Rejects path traversal attempts (`..`, null bytes, control chars).
 */
export function sanitizeSftpPath(rawPath: string): string {
  if (rawPath.includes('\0')) {
    throw new SftpError(SftpErrorCode.SFTP_INVALID_PATH, 'Path contains null bytes')
  }

  const posixPath = rawPath.replace(/\\/g, '/')
  const normalized = path.posix.normalize(posixPath.startsWith('/') ? posixPath : `/${posixPath}`)

  if (!normalized.startsWith('/')) {
    throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'Path escapes virtual filesystem root')
  }

  return normalized
}

export function parseAllowedRoots(allowedRootsJson: string): string[] {
  try {
    const parsed = JSON.parse(allowedRootsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Resolves a normalized path against the user's allowed roots and account mapping.
 * Throws SFTP_ROOT_DENIED if the path targets a subtree not permitted by allowedRoots.
 */
export function resolveVfsPath(
  rawPath: string,
  allowedRootsJson: string,
  accounts: VfsAccountMapping[],
): VfsResolvedTarget {
  const norm = sanitizeSftpPath(rawPath)
  const allowedRoots = parseAllowedRoots(allowedRootsJson)

  if (norm === '/' || norm === '') {
    return { type: 'root', normalizedPath: '/' }
  }

  const parts = norm.split('/').filter(Boolean)
  const top = parts[0] // 'pool', 'drive', or 's3'

  if (top === 'pool') {
    const isPoolAllowed = allowedRoots.some((r) => r === 'pool' || r === 'pool/*')
    if (!isPoolAllowed) {
      throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, 'Access to pool root is not allowed by profile')
    }
    if (parts.length === 1) {
      return { type: 'pool_root', normalizedPath: '/pool', isPool: true }
    }
    const subPath = parts.slice(1).join('/')
    return {
      type: 'node',
      normalizedPath: norm,
      isPool: true,
      subPath,
    }
  }

  if (top === 'drive' || top === 's3') {
    const expectedProvider = top === 'drive' ? 'google_drive' : 's3'

    if (parts.length === 1) {
      return {
        type: top === 'drive' ? 'drive_root' : 's3_root',
        normalizedPath: `/${top}`,
      }
    }

    const accountLabel = parts[1]
    const matchedAccount = accounts.find(
      (a) => a.provider === expectedProvider && a.label.toLowerCase() === accountLabel.toLowerCase(),
    )

    if (!matchedAccount) {
      throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, `Storage target /${top}/${accountLabel} not found`)
    }

    const grantMatches = allowedRoots.some(
      (r) => r === `${top}/${matchedAccount.id}` || r === `${top}/*` || r === '*' || r === matchedAccount.id,
    )
    if (!grantMatches) {
      throw new SftpError(
        SftpErrorCode.SFTP_ROOT_DENIED,
        `Target ${matchedAccount.label} (${matchedAccount.id}) is not granted in allowedRoots`,
      )
    }

    if (parts.length === 2) {
      return {
        type: 'account_root',
        normalizedPath: `/${top}/${matchedAccount.label}`,
        accountId: matchedAccount.id,
        accountLabel: matchedAccount.label,
        provider: expectedProvider,
      }
    }

    const subPath = parts.slice(2).join('/')
    return {
      type: 'node',
      normalizedPath: norm,
      accountId: matchedAccount.id,
      accountLabel: matchedAccount.label,
      provider: expectedProvider,
      subPath,
    }
  }

  throw new SftpError(SftpErrorCode.SFTP_ROOT_DENIED, `Root /${top} is not recognized`)
}
