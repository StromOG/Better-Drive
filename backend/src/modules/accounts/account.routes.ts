import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { patchAccountSchema } from './account.schema.js'
import {
  disconnectAccount,
  getAccountHealth,
  patchAccount,
  reauthAccount,
} from './account.service.js'

export const accountRouter = Router()

accountRouter.use(requireAuth)

accountRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const body = patchAccountSchema.parse(req.body)
    const updated = await patchAccount(req.user!.id, String(req.params.id), body, req.ip)
    return res.json({ account: updated })
  } catch (error) {
    return next(error)
  }
})

accountRouter.post('/:id/reauth', async (req: AuthRequest, res, next) => {
  try {
    const result = await reauthAccount(req.user!.id, String(req.params.id), req.ip)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

accountRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await disconnectAccount(req.user!.id, String(req.params.id), req.ip)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

accountRouter.get('/:id/health', async (req: AuthRequest, res, next) => {
  try {
    const health = await getAccountHealth(req.user!.id, String(req.params.id))
    return res.json(health)
  } catch (error) {
    return next(error)
  }
})
