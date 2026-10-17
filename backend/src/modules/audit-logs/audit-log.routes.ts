import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { parseRecord } from '../../utils/json-column.js'

export const auditLogRouter = Router()
auditLogRouter.use(requireAuth)

const querySchema = z.object({
  action: z.string().trim().max(191).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

auditLogRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const query = querySchema.parse(req.query)

    // Fetch one extra row to tell whether another page exists without a
    // second count query.
    const rows = await prisma.auditLog.findMany({
      where: {
        userId: req.user!.id,
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
      },
    })

    const page = rows.slice(0, query.limit)
    return res.json({
      logs: page.map((log) => ({ ...log, metadata: parseRecord(log.metadata) })),
      nextCursor: rows.length > query.limit ? page.at(-1)?.id : null,
    })
  } catch (error) {
    return next(error)
  }
})

/** The distinct actions present, so the UI can offer a real filter list. */
auditLogRouter.get('/actions', async (req: AuthRequest, res, next) => {
  try {
    const grouped = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { userId: req.user!.id },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 50,
    })
    return res.json({
      actions: grouped.map((row) => ({ action: row.action, count: row._count.action })),
    })
  } catch (error) {
    return next(error)
  }
})
