import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { containsInsensitive } from '../../utils/db.js'

/**
 * Shared query shapes for the file endpoints.
 *
 * Kept out of the route file so list, search, trash, starred, recent and
 * duplicates all return the same fields in the same shape, and so the
 * frontend only has one response contract to model.
 */

/** Relations the list UI needs. Narrow on purpose: never select token columns. */
export const fileInclude = {
  connectedAccount: { select: { id: true, email: true, provider: true } },
  folder: { select: { id: true, name: true, color: true } },
} satisfies Prisma.FileInclude

export type FileWithRelations = Prisma.FileGetPayload<{ include: typeof fileInclude }>

/**
 * Serialises a file for JSON.
 *
 * `sizeBytes` is a BigInt, which JSON.stringify refuses to encode, so every
 * response goes through here rather than relying on each route to remember.
 */
export function serializeFile(file: FileWithRelations) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    checksum: file.checksum,
    provider: file.provider,
    starred: file.starred,
    starredAt: file.starredAt?.toISOString() ?? null,
    lastViewedAt: file.lastViewedAt?.toISOString() ?? null,
    status: file.status,
    folderId: file.folderId,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    deletedAt: file.deletedAt?.toISOString() ?? null,
    connectedAccount: file.connectedAccount,
    folder: file.folder,
  }
}

/**
 * MIME groups behind the `kind` filter.
 *
 * Prefix entries match a whole family (`image/`), which keeps formats the
 * upstream hardcoded list missed — AVIF, HEIC, MKV — from being invisible to
 * the type filter.
 */
const KIND_MATCHERS: Record<string, { prefixes: string[]; exact: string[] }> = {
  photo: { prefixes: ['image/'], exact: [] },
  image: { prefixes: ['image/'], exact: [] },
  video: { prefixes: ['video/'], exact: [] },
  audio: { prefixes: ['audio/'], exact: [] },
  document: {
    prefixes: ['text/'],
    exact: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
      'application/vnd.google-apps.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.google-apps.spreadsheet',
      'text/csv',
    ],
  },
  pdf: { prefixes: [], exact: ['application/pdf'] },
  doc: {
    prefixes: ['text/'],
    exact: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
      'application/vnd.google-apps.document',
    ],
  },
  sheet: {
    prefixes: [],
    exact: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.google-apps.spreadsheet',
      'text/csv',
    ],
  },
  archive: {
    prefixes: [],
    exact: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/x-tar',
      'application/gzip',
      'application/x-7z-compressed',
      'application/x-bzip2',
    ],
  },
  code: {
    prefixes: [
      'text/javascript',
      'text/typescript',
      'text/x-',
      'text/html',
      'text/css',
    ],
    exact: [
      'application/json',
      'application/javascript',
      'application/typescript',
      'application/xml',
      'application/x-sh',
      'application/x-python',
    ],
  },
}

export const fileKinds = Object.keys(KIND_MATCHERS) as [string, ...string[]]

function kindFilter(kind: string): Prisma.FileWhereInput | null {
  if (kind === 'other') {
    // Other matches files that don't belong to any known prefix or exact list
    const allPrefixes = Object.values(KIND_MATCHERS).flatMap((m) => m.prefixes)
    const allExact = Object.values(KIND_MATCHERS).flatMap((m) => m.exact)
    return {
      AND: [
        ...allPrefixes.map((p) => ({ mimeType: { not: { startsWith: p } } })),
        { mimeType: { notIn: allExact } },
      ],
    }
  }

  const matcher = KIND_MATCHERS[kind]
  if (!matcher) return null

  const clauses: Prisma.FileWhereInput[] = matcher.prefixes.map((prefix) => ({
    mimeType: { startsWith: prefix },
  }))
  if (matcher.exact.length > 0) clauses.push({ mimeType: { in: matcher.exact } })

  return clauses.length === 1 ? clauses[0] : { OR: clauses }
}

export const fileSortFields = ['name', 'size', 'created', 'updated'] as const
export type FileSortField = (typeof fileSortFields)[number]

export function fileOrderBy(
  sort: FileSortField,
  direction: 'asc' | 'desc',
): Prisma.FileOrderByWithRelationInput[] {
  const primary: Prisma.FileOrderByWithRelationInput =
    sort === 'name'
      ? { name: direction }
      : sort === 'size'
        ? { sizeBytes: direction }
        : sort === 'updated'
          ? { updatedAt: direction }
          : { createdAt: direction }

  // `id` breaks ties so cursor pagination cannot repeat or skip a row when
  // several files share a name, size or timestamp.
  return [primary, { id: 'desc' }]
}

export const fileFilterSchema = z.object({
  folderId: z.string().uuid().optional(),
  q: z.string().trim().max(255).optional(),
  kind: z.string().optional(),
  accountId: z.string().uuid().optional(),
  account: z.string().uuid().optional(),
  minSize: z.coerce.number().int().nonnegative().optional(),
  maxSize: z.coerce.number().int().nonnegative().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  starred: z.enum(['true', 'false']).optional(),
})

export type FileFilter = z.infer<typeof fileFilterSchema>

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  sort: z.enum(fileSortFields).default('created'),
  direction: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * Builds the `where` clause for a file query.
 *
 * `folderId` is only applied when the caller passed it, so an unfiltered
 * search spans every folder while browsing stays scoped to one.
 */
export function buildFileWhere(
  userId: string,
  filter: FileFilter,
  status: 'active' | 'deleted',
): Prisma.FileWhereInput {
  const and: Prisma.FileWhereInput[] = []

  if (filter.kind) {
    const kind = kindFilter(filter.kind)
    if (kind) and.push(kind)
  }

  if (filter.minSize !== undefined || filter.maxSize !== undefined) {
    and.push({
      sizeBytes: {
        ...(filter.minSize !== undefined ? { gte: BigInt(filter.minSize) } : {}),
        ...(filter.maxSize !== undefined ? { lte: BigInt(filter.maxSize) } : {}),
      },
    })
  }

  if (filter.startDate || filter.endDate) {
    and.push({
      createdAt: {
        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
        ...(filter.endDate ? { lte: new Date(filter.endDate) } : {}),
      },
    })
  }

  const targetAccountId = filter.accountId || filter.account
  return {
    userId,
    status,
    ...(filter.folderId !== undefined ? { folderId: filter.folderId } : {}),
    ...(filter.q ? { name: containsInsensitive(filter.q) } : {}),
    ...(targetAccountId
      ? { connectedAccountId: targetAccountId }
      : { connectedAccount: { enabled: true } }),
    ...(filter.starred ? { starred: filter.starred === 'true' } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  }
}
