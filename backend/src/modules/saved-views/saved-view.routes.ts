import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'

export const savedViewRouter = Router()

savedViewRouter.use(requireAuth)

const createViewSchema = z.object({
  name: z.string().trim().min(1).max(100),
  query: z.string().trim().min(1).max(500),
  icon: z.string().trim().max(50).optional().nullable(),
  pinned: z.boolean().optional(),
})

const updateViewSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(500).optional(),
  icon: z.string().trim().max(50).optional().nullable(),
  pinned: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

savedViewRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const views = await prisma.savedView.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ pinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
    return res.json({ views })
  } catch (error) {
    return next(error)
  }
})

savedViewRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createViewSchema.parse(req.body)
    const view = await prisma.savedView.create({
      data: {
        userId: req.user!.id,
        name: body.name,
        query: body.query,
        icon: body.icon ?? null,
        pinned: body.pinned ?? true,
      },
    })
    return res.status(201).json({ view })
  } catch (error) {
    return next(error)
  }
})

savedViewRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateViewSchema.parse(req.body)
    const view = await prisma.savedView.update({
      where: { id, userId: req.user!.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.query !== undefined ? { query: body.query } : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    })
    return res.json({ view })
  } catch (error) {
    return next(error)
  }
})

savedViewRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await prisma.savedView.delete({
      where: { id, userId: req.user!.id },
    })
    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})
