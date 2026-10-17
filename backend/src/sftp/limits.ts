import { env } from '../config/env.js'

interface RateBucket {
  failures: number[]
}

const authFailuresByIp = new Map<string, RateBucket>()
const activeClientsByUserId = new Map<string, Set<unknown>>()
let totalActiveConnections = 0

export function isIpRateLimited(remoteIp: string): boolean {
  const now = Date.now()
  const windowStart = now - env.SFTP_AUTH_WINDOW_MS
  const bucket = authFailuresByIp.get(remoteIp)
  if (!bucket) return false

  bucket.failures = bucket.failures.filter((t) => t > windowStart)
  if (bucket.failures.length === 0) {
    authFailuresByIp.delete(remoteIp)
    return false
  }
  return bucket.failures.length >= env.SFTP_AUTH_MAX_ATTEMPTS
}

export function recordAuthFailure(remoteIp: string): void {
  const now = Date.now()
  const windowStart = now - env.SFTP_AUTH_WINDOW_MS
  let bucket = authFailuresByIp.get(remoteIp)
  if (!bucket) {
    bucket = { failures: [] }
    authFailuresByIp.set(remoteIp, bucket)
  }
  bucket.failures = bucket.failures.filter((t) => t > windowStart)
  bucket.failures.push(now)
}

export function recordAuthSuccess(remoteIp: string): void {
  authFailuresByIp.delete(remoteIp)
}

export function resetAuthRateLimits(): void {
  authFailuresByIp.clear()
}

export function canAcceptGlobalConnection(): boolean {
  return totalActiveConnections < env.SFTP_MAX_CONNECTIONS
}

export function canAcceptUserSession(userId: string): boolean {
  const existing = activeClientsByUserId.get(userId)
  const currentCount = existing ? existing.size : 0
  return currentCount < env.SFTP_USER_MAX_SESSIONS
}

export function registerClientSession(userId: string, clientToken: unknown): void {
  totalActiveConnections++
  let set = activeClientsByUserId.get(userId)
  if (!set) {
    set = new Set()
    activeClientsByUserId.set(userId, set)
  }
  set.add(clientToken)
}

export function unregisterClientSession(userId: string, clientToken: unknown): void {
  if (totalActiveConnections > 0) totalActiveConnections--
  const set = activeClientsByUserId.get(userId)
  if (set) {
    set.delete(clientToken)
    if (set.size === 0) activeClientsByUserId.delete(userId)
  }
}

export function checkUploadSizeLimit(sizeBytes: bigint, profileMaxBytes: bigint | null): boolean {
  if (profileMaxBytes !== null && sizeBytes > profileMaxBytes) return false
  if (env.SFTP_MAX_UPLOAD_BYTES !== undefined && sizeBytes > BigInt(env.SFTP_MAX_UPLOAD_BYTES)) return false
  return true
}

export function getActiveSessionStats() {
  return {
    totalActive: totalActiveConnections,
    maxGlobal: env.SFTP_MAX_CONNECTIONS,
    maxPerUser: env.SFTP_USER_MAX_SESSIONS,
  }
}
