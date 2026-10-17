export const SftpErrorCode = {
  SFTP_ROOT_DENIED: 'SFTP_ROOT_DENIED',
  SFTP_QUOTA_EXCEEDED: 'SFTP_QUOTA_EXCEEDED',
  SFTP_KEY_REVOKED: 'SFTP_KEY_REVOKED',
  SFTP_PROFILE_DISABLED: 'SFTP_PROFILE_DISABLED',
  SFTP_TOO_MANY_SESSIONS: 'SFTP_TOO_MANY_SESSIONS',
  SFTP_INVALID_PATH: 'SFTP_INVALID_PATH',
  SFTP_AUTH_FAILED: 'SFTP_AUTH_FAILED',
  SFTP_PORT_IN_USE: 'SFTP_PORT_IN_USE',
  SFTP_HOST_KEY_ERROR: 'SFTP_HOST_KEY_ERROR',
} as const

export type SftpErrorCodeType = (typeof SftpErrorCode)[keyof typeof SftpErrorCode]

export class SftpError extends Error {
  constructor(
    readonly code: SftpErrorCodeType,
    message: string,
  ) {
    super(message)
    this.name = 'SftpError'
  }
}
