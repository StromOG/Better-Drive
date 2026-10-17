import { Router } from 'express'
import { requireAdmin, requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { invitationRouter } from '../invitations/invitation.routes.js'
import {
  bulkDisableSchema,
  bulkRoleSchema,
  updateRoleSchema,
} from './member.schema.js'
import {
  bulkChangeRole,
  bulkDisableMembers,
  changeMemberRole,
  listMembers,
  removeMember,
} from './member.service.js'

export const memberRouter = Router()

memberRouter.use(requireAuth, requireAdmin)

// Sub-route for invitations under /system/members/invitations
memberRouter.use('/invitations', invitationRouter)

memberRouter.get('/', async (_req: AuthRequest, res, next) => {
  try {
    const members = await listMembers()
    return res.json({ members })
  } catch (error) {
    return next(error)
  }
})

memberRouter.patch('/:id/role', async (req: AuthRequest, res, next) => {
  try {
    const body = updateRoleSchema.parse(req.body)
    const updated = await changeMemberRole(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
      body.role,
      req.ip,
    )
    return res.json({ member: updated })
  } catch (error) {
    return next(error)
  }
})

memberRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await removeMember(
      req.user!.id,
      req.user!.role,
      String(req.params.id),
      req.ip,
    )
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

memberRouter.post('/bulk-role', async (req: AuthRequest, res, next) => {
  try {
    const body = bulkRoleSchema.parse(req.body)
    const result = await bulkChangeRole(
      req.user!.id,
      req.user!.role,
      body.userIds,
      body.role,
      req.ip,
    )
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

memberRouter.post('/bulk-disable', async (req: AuthRequest, res, next) => {
  try {
    const body = bulkDisableSchema.parse(req.body)
    const result = await bulkDisableMembers(
      req.user!.id,
      req.user!.role,
      body.userIds,
      req.ip,
    )
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})
