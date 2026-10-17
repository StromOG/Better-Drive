import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { getMascotSettings, getSmartMascotTelemetry, updateMascotSettings } from './mascot.service.js'

export const mascotRouter = Router()

mascotRouter.use(requireAuth)

const updateSettingsSchema = z.object({
  accessory: z.enum(['none', 'detective', 'sunglasses', 'crown', 'party']).optional(),
  colorTheme: z.enum(['candy', 'cyan', 'pink', 'midnight', 'mint']).optional(),
  dashboardTheme: z.string().optional(),
  soundEnabled: z.boolean().optional(),
  hasSeenTour: z.boolean().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable()
    .optional(),
  minimized: z.boolean().optional(),
  avatarUrl: z.string().max(300000).optional(),
})

mascotRouter.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    const settings = await getMascotSettings(req.user!.id)
    return res.json({ settings })
  } catch (error) {
    return next(error)
  }
})

mascotRouter.put('/settings', async (req: AuthRequest, res, next) => {
  try {
    const patch = updateSettingsSchema.parse(req.body)
    const settings = await updateMascotSettings(req.user!.id, patch)
    return res.json({ settings })
  } catch (error) {
    return next(error)
  }
})

mascotRouter.get('/smart-tips', async (req: AuthRequest, res, next) => {
  try {
    const telemetry = await getSmartMascotTelemetry(req.user!.id)
    return res.json({
      tips: telemetry.tips,
      telemetry,
      insights: telemetry.insights,
      primaryGreeting: telemetry.primaryGreeting,
    })
  } catch (error) {
    return next(error)
  }
})

mascotRouter.get('/telemetry', async (req: AuthRequest, res, next) => {
  try {
    const telemetry = await getSmartMascotTelemetry(req.user!.id)
    return res.json({ telemetry })
  } catch (error) {
    return next(error)
  }
})
