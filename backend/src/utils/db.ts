import { env } from '../config/env.js'

/**
 * Provider differences that leak into query construction.
 *
 * Prisma's `mode: 'insensitive'` is only implemented for PostgreSQL and
 * throws on SQLite and MySQL. Those two are already case-insensitive for
 * ASCII through their default LIKE semantics, so the flag is only added
 * where it is both needed and supported.
 */
const isPostgres =
  env.DATABASE_PROVIDER === 'postgres' || env.DATABASE_PROVIDER === 'postgresql'

export function containsInsensitive(value: string) {
  return isPostgres ? { contains: value, mode: 'insensitive' as const } : { contains: value }
}

/** Splits an array into fixed-size batches for chunked writes. */
export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups
}
