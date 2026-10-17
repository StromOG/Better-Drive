import { prisma } from '../config/prisma.js'
import { serializeJson } from './json-column.js'

/**
 * Appends to the audit log.
 *
 * Deliberately swallows its own failures: an audit write must never be the
 * reason a user's action fails. Failures are logged so they are still visible
 * in the server output.
 */
export async function createAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const { ip, ...rest } = metadata ?? {}
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        ipAddress: typeof ip === 'string' ? ip.slice(0, 64) : null,
        metadata: Object.keys(rest).length > 0 ? serializeJson(rest) : null,
      },
    })
  } catch (error) {
    console.error('Failed to write audit log entry:', error)
  }
}
