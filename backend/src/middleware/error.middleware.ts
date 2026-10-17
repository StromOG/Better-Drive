import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { SftpError } from '../sftp/errors.js'

/**
 * Errors with a deliberate HTTP status. Throw these for expected failures so
 * routes can stay linear instead of threading `res.status(...)` through every
 * branch.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new HttpError(400, code, message)
  }

  static forbidden(message: string, code = 'FORBIDDEN') {
    return new HttpError(403, code, message)
  }

  static notFound(message: string, code = 'NOT_FOUND') {
    return new HttpError(404, code, message)
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new HttpError(409, code, message)
  }
}

/** Prisma error codes we can map onto a meaningful status. */
const PRISMA_STATUS: Record<string, { status: number; code: string; message: string }> = {
  P2025: { status: 404, code: 'NOT_FOUND', message: 'The requested record does not exist.' },
  P2002: { status: 409, code: 'CONFLICT', message: 'That value is already taken.' },
  P2003: {
    status: 409,
    code: 'CONFLICT',
    message: 'That record is still referenced by something else.',
  },
}

function prismaCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : null
}

const CODE_STATUS: Record<string, number> = {
  INVITATION_NOT_FOUND: 404,
  INVITATION_EXPIRED: 410,
  INVITATION_ALREADY_ACCEPTED: 409,
  INVITATION_EMAIL_MISMATCH: 403,
  INVITATION_ADMIN_REQUIRES_OWNER: 403,
  MEMBER_CANNOT_CHANGE_OWN_ROLE: 400,
  MEMBER_CANNOT_REMOVE_LAST_OWNER: 400,
  MEMBER_NOT_FOUND: 404,
  ACCOUNT_REAUTH_REQUIRED: 401,
  ACCOUNT_REVOKED: 403,
  API_KEY_INVALID: 401,
  API_KEY_REVOKED: 401,
}

export function notFoundMiddleware(req: Request, res: Response) {
  return res.status(404).json({
    code: 'ROUTE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
  })
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(error)

  if (error instanceof HttpError) {
    return res.status(error.status).json({ code: error.code, message: error.message })
  }

  if (typeof error === 'object' && error !== null && 'code' in error && typeof (error as any).code === 'string') {
    const code = (error as any).code
    const status = CODE_STATUS[code]
    if (status) {
      return res.status(status).json({ code, message: (error as any).message || code })
    }
  }

  if (error instanceof SftpError) {
    const statusMap: Record<string, number> = {
      SFTP_ROOT_DENIED: 403,
      SFTP_QUOTA_EXCEEDED: 413,
      SFTP_KEY_REVOKED: 403,
      SFTP_PROFILE_DISABLED: 403,
      SFTP_TOO_MANY_SESSIONS: 429,
      SFTP_INVALID_PATH: 400,
      SFTP_AUTH_FAILED: 401,
      SFTP_PORT_IN_USE: 409,
      SFTP_HOST_KEY_ERROR: 500,
    }
    const status = statusMap[error.code] ?? 400
    return res.status(status).json({ code: error.code, message: error.message })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: 'Some of the submitted values are not valid.',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const mapped = PRISMA_STATUS[prismaCode(error) ?? '']
  if (mapped) {
    return res.status(mapped.status).json({ code: mapped.code, message: mapped.message })
  }

  // CORS rejections surface here as plain errors.
  if (error instanceof Error && error.message.includes('not allowed by CORS_ORIGINS')) {
    return res.status(403).json({ code: 'CORS_ORIGIN_REJECTED', message: error.message })
  }

  // Catch disk/storage exhaustion specifically
  const rawMsg = error instanceof Error ? error.message : String(error ?? '')
  if (rawMsg.includes('database or disk is full')) {
    console.error('Storage exhaustion error:', error)
    return res.status(507).json({
      code: 'INSUFFICIENT_STORAGE',
      message: 'Server storage is full. Please free up disk space on the server drive.',
    })
  }

  // Sanitize Prisma and internal connector errors so code paths and invocation dumps never reach clients
  if (rawMsg.includes('Invalid `prisma.') || rawMsg.includes('ConnectorError') || rawMsg.includes('SqliteError')) {
    console.error('Database connector error:', error)
    return res.status(500).json({
      code: 'DATABASE_ERROR',
      message: 'A database error occurred. Please try again later.',
    })
  }

  // Anything unrecognised is a bug. Log it with the stack, but do not hand the
  // internal message to the caller if it looks like a code dump.
  console.error('Unhandled error:', error)
  const isDevCodeDump = rawMsg.includes('\n') || rawMsg.includes('at ') || rawMsg.includes('\\') || rawMsg.includes('/')
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: env.isProduction || isDevCodeDump
      ? 'Something went wrong on our end. Please try again.'
      : rawMsg || 'Internal server error',
  })
}
