import { prisma } from '../config/prisma.js'

export type SftpAuditEvent =
  | 'AUTH_OK'
  | 'AUTH_FAIL'
  | 'OPEN'
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'RENAME'
  | 'MKDIR'
  | 'DISCONNECT'

export type SftpAuditOutcome = 'OK' | 'DENIED' | 'ERROR'

export interface SftpLogEntry {
  keyId?: string | null
  userId?: string | null
  remoteIp: string
  event: SftpAuditEvent
  path?: string | null
  bytes?: bigint | number | null
  outcome: SftpAuditOutcome
}

export async function writeSftpAuditLog(entry: SftpLogEntry): Promise<void> {
  try {
    await prisma.sftpSessionLog.create({
      data: {
        keyId: entry.keyId ?? null,
        userId: entry.userId ?? null,
        remoteIp: entry.remoteIp.slice(0, 64),
        event: entry.event,
        path: entry.path ? entry.path.slice(0, 500) : null,
        bytes: entry.bytes !== null && entry.bytes !== undefined ? BigInt(entry.bytes) : null,
        outcome: entry.outcome,
      },
    })
  } catch {
    // Audit failures must not throw or crash in-flight transfers
  }
}
