import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { createApiKeySchema } from './api-key.schema.js'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from './api-key.service.js'

export const apiKeyRouter = Router()

apiKeyRouter.use(requireAuth)

apiKeyRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const apiKeys = await listApiKeys(req.user!.id)
    return res.json({ apiKeys })
  } catch (error) {
    return next(error)
  }
})

apiKeyRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createApiKeySchema.parse(req.body)
    const result = await createApiKey(req.user!.id, body.label, req.ip)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

apiKeyRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await revokeApiKey(req.user!.id, String(req.params.id), req.ip)
    return res.json({ status: 'ok', apiKey: result })
  } catch (error) {
    return next(error)
  }
})
