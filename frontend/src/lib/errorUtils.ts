/**
 * Utility to parse and format auth & API errors into clean, friendly human messages.
 * Strips any internal stack traces, Prisma AST invocations, or raw database connector errors.
 */
export function formatFriendlyAuthError(err: unknown): string {
  if (!err) return 'An unexpected error occurred. Please try again.'

  const raw = typeof err === 'string'
    ? err
    : (err instanceof Error ? err.message : String(err))

  const lower = raw.toLowerCase()

  // 1. Storage / Disk full errors
  if (
    lower.includes('database or disk is full') ||
    lower.includes('disk is full') ||
    lower.includes('sqlite_full') ||
    lower.includes('insufficient_storage') ||
    lower.includes('extended_code: 13')
  ) {
    return 'Server storage is full. Please free up space on your C: drive and try again.'
  }

  // 2. Email conflict / taken
  if (
    lower.includes('auth_email_taken') ||
    lower.includes('that email is already registered') ||
    lower.includes('already registered') ||
    lower.includes('already taken')
  ) {
    return 'That email is already registered. Try signing in instead!'
  }

  // 3. Invalid credentials
  if (
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('wrong password') ||
    lower.includes('user not found')
  ) {
    return 'Invalid email or password. Please double-check your credentials.'
  }

  // 4. Rate limit
  if (lower.includes('too many') || lower.includes('rate limit')) {
    return 'Too many attempts. Please slow down and wait a minute.'
  }

  // 5. Network / server unreachable
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('econnrefused')
  ) {
    return 'Unable to reach the server. Please check your connection and try again.'
  }

  // 6. Recaptcha issues
  if (lower.includes('captcha')) {
    return 'Please complete the verification captcha.'
  }

  // 7. Prisma / Connector / Code Dumps (catch any lingering raw trace)
  if (
    raw.includes('Invalid `prisma.') ||
    raw.includes('ConnectorError') ||
    raw.includes('SqliteError') ||
    raw.includes('QueryError') ||
    raw.includes('auth.routes.ts') ||
    raw.includes('node_modules') ||
    raw.includes('at ') ||
    raw.includes('\\') ||
    raw.includes('/')
  ) {
    return 'Database connection error. Please try again in a few moments.'
  }

  // 8. Default safe return of clean string
  return raw.length > 120 ? `${raw.slice(0, 117)}...` : raw
}
