import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from './notification.service.js'

export const notificationRouter = Router()

notificationRouter.use(requireAuth)

const updatePreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      eventType: z.string().min(1),
      enabled: z.boolean(),
    }),
  ),
})

notificationRouter.get('/preferences', async (req: AuthRequest, res, next) => {
  try {
    const preferences = await getNotificationPreferences(req.user!.id)
    return res.json({ preferences })
  } catch (error) {
    return next(error)
  }
})

notificationRouter.patch('/preferences', async (req: AuthRequest, res, next) => {
  try {
    const body = updatePreferencesSchema.parse(req.body)
    const preferences = await updateNotificationPreferences(req.user!.id, body.preferences)
    return res.json({ preferences })
  } catch (error) {
    return next(error)
  }
})
