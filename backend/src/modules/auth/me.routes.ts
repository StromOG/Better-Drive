import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { hashPassword, verifyPassword } from '../../utils/password.js'
import { createAuditLog } from '../../utils/audit.js'
import { updateMascotSettings } from '../mascot/mascot.service.js'

export const meRouter = Router()

meRouter.use(requireAuth)

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  avatarUrl: z.string().max(300000).optional(),
  gravatarEnabled: z.boolean().optional(),
})

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1),
  newEmail: z.string().trim().toLowerCase().email(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.').max(256),
})

const deleteAccountSchema = z.object({
  password: z.string().min(1),
})

meRouter.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        gravatarEnabled: true,
        createdAt: true,
      },
    })
    return res.json({ user })
  } catch (error) {
    return next(error)
  }
})

meRouter.patch('/profile', async (req: AuthRequest, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: body.name,
        gravatarEnabled: body.gravatarEnabled,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        gravatarEnabled: true,
      },
    })
    if (body.avatarUrl !== undefined) {
      await updateMascotSettings(req.user!.id, { avatarUrl: body.avatarUrl })
    }
    return res.json({ user })
  } catch (error) {
    return next(error)
  }
})

meRouter.post('/change-email', async (req: AuthRequest, res, next) => {
  try {
    const body = changeEmailSchema.parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw HttpError.badRequest('Current password is incorrect.', 'AUTH_INVALID_CREDENTIALS')
    }
    const existing = await prisma.user.findUnique({ where: { email: body.newEmail } })
    if (existing && existing.id !== user.id) {
      throw HttpError.conflict('A user with this email address already exists.', 'USER_EXISTS')
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { email: body.newEmail },
      select: { id: true, name: true, email: true, role: true, status: true, gravatarEnabled: true },
    })
    await createAuditLog(user.id, 'auth.email_changed', 'user', user.id, {
      oldEmail: user.email,
      newEmail: body.newEmail,
      ip: req.ip,
    })
    return res.json({ status: 'ok', user: updated })
  } catch (error) {
    return next(error)
  }
})

meRouter.post('/change-password', async (req: AuthRequest, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw HttpError.badRequest('Current password is incorrect.', 'AUTH_INVALID_CREDENTIALS')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(body.newPassword) },
      }),
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: req.user!.sessionId } },
        data: { revokedAt: new Date() },
      }),
    ])

    await createAuditLog(user.id, 'auth.password_changed', 'user', user.id, { ip: req.ip })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

meRouter.delete('/account', async (req: AuthRequest, res, next) => {
  try {
    const body = deleteAccountSchema.parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      throw HttpError.badRequest('Password is incorrect.', 'AUTH_INVALID_CREDENTIALS')
    }
    if (user.role === 'owner') {
      const ownerCount = await prisma.user.count({ where: { role: 'owner', status: 'active' } })
      if (ownerCount <= 1) {
        throw new HttpError(
          400,
          'MEMBER_CANNOT_REMOVE_LAST_OWNER',
          'Cannot delete the last remaining owner account.',
        )
      }
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { status: 'disabled' },
      }),
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    await createAuditLog(user.id, 'auth.account_deleted', 'user', user.id, { ip: req.ip })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})
