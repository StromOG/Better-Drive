import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireAdmin, requireAuth, requireOwner, type AuthRequest } from '../../middleware/auth.middleware.js'
import { createAuditLog } from '../../utils/audit.js'

export const adminRouter = Router()

// All routes here require authentication and admin privileges
adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const [userCount, fileCount, connectedAccountCount, storageAgg] = await Promise.all([
      prisma.user.count(),
      prisma.file.count({ where: { deletedAt: null } }),
      prisma.connectedAccount.count({ where: { status: 'connected' } }),
      prisma.file.aggregate({
        where: { deletedAt: null },
        _sum: { sizeBytes: true },
      }),
    ])

    return res.json({
      users: userCount,
      files: fileCount,
      connectedAccounts: connectedAccountCount,
      totalStorageBytes: storageAgg._sum.sizeBytes?.toString() ?? '0',
    })
  } catch (error) {
    return next(error)
  }
})

adminRouter.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            files: { where: { deletedAt: null } },
            connectedAccounts: { where: { status: 'connected' } },
          },
        },
      },
    })

    return res.json({ users })
  } catch (error) {
    return next(error)
  }
})

const updateUserSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
})

adminRouter.patch('/users/:id', async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateUserSchema.parse(req.body)

    if (body.role === 'owner' && req.user!.role !== 'owner') {
      return res.status(403).json({
        code: 'FORBIDDEN_OWNER_ONLY',
        message: 'Only the current owner can transfer ownership.',
      })
    }

    // Prevent demoting yourself if you're the only owner
    if (targetUserId === req.user!.id && body.role && body.role !== 'owner' && req.user!.role === 'owner') {
      const ownerCount = await prisma.user.count({ where: { role: 'owner', status: 'active' } })
      if (ownerCount <= 1) {
        return res.status(400).json({
          code: 'CANNOT_DEMOTE_SOLE_OWNER',
          message: 'Cannot demote the sole owner of the system.',
        })
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(body.role ? { role: body.role } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    })

    await createAuditLog(
      req.user!.id,
      'admin.user.update',
      'user',
      targetUserId,
      { changes: body, ip: req.ip, userAgent: req.get('user-agent') },
    )

    return res.json({ user: updated })
  } catch (error) {
    return next(error)
  }
})

adminRouter.delete('/users/:id', requireOwner, async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (targetUserId === req.user!.id) {
      return res.status(400).json({
        code: 'CANNOT_DELETE_SELF',
        message: 'Cannot delete your own account via admin api.',
      })
    }

    await prisma.user.delete({ where: { id: targetUserId } })

    await createAuditLog(
      req.user!.id,
      'admin.user.delete',
      'user',
      targetUserId,
      { ip: req.ip, userAgent: req.get('user-agent') },
    )

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})
