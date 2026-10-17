import { Router } from 'express'
import { prisma } from '../../config/prisma.js'
import { requireAdmin, requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { createInvitationSchema } from './invitation.schema.js'
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  revokeInvitation,
} from './invitation.service.js'

export const invitationRouter = Router()

// Owner / Admin endpoints for managing invitations
invitationRouter.use(requireAuth, requireAdmin)

invitationRouter.get('/', async (_req: AuthRequest, res, next) => {
  try {
    const invitations = await listInvitations()
    return res.json({ invitations })
  } catch (error) {
    return next(error)
  }
})

invitationRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createInvitationSchema.parse(req.body)
    const result = await createInvitation(
      req.user!.id,
      req.user!.role,
      body.email,
      body.role,
      req.ip,
    )
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

invitationRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const invitation = await revokeInvitation(req.user!.id, String(req.params.id), req.ip)
    return res.json({ status: 'ok', invitation })
  } catch (error) {
    return next(error)
  }
})

// Public/authenticated accept route
export const publicInvitationRouter = Router()

publicInvitationRouter.post('/:token/accept', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, email: true },
    })
    const result = await acceptInvitation(user.id, user.email, String(req.params.token), req.ip)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})
