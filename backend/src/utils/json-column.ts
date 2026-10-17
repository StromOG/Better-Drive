/**
 * JSON stored in `String` columns.
 *
 * Prisma's `Json` scalar is not available on SQLite, which is Better Drive's
 * default provider. Rather than keep three schemas that differ in column
 * types, the handful of JSON-shaped fields are plain `String` columns holding
 * serialised JSON on every provider.
 *
 * This is lossless in practice: none of these fields is ever queried by JSON
 * path, only read and written whole.
 *
 * Reads are deliberately forgiving. A column that holds malformed JSON, or a
 * value of the wrong shape, falls back to an empty result instead of throwing
 * — a corrupt `scopes` column should not take down an authentication request.
 */

export function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed === null || parsed === undefined ? fallback : (parsed as T)
  } catch {
    return fallback
  }
}

/** Reads a column expected to hold an array of strings. */
export function parseStringArray(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === 'string')
}

/** Reads a column expected to hold a JSON object. */
export function parseRecord(value: string | null | undefined): Record<string, unknown> {
  const parsed = parseJson<unknown>(value, {})
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed as Record<string, unknown>
}
