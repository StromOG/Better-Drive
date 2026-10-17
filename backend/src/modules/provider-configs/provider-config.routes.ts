import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { decryptText, encryptText } from '../../utils/crypto.js'
import { parseStringArray, serializeJson } from '../../utils/json-column.js'

export const providerConfigRouter = Router()
providerConfigRouter.use(requireAuth)

const defaultGoogleScopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
]

const schema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required'),
  clientSecret: z.string().trim().min(1, 'Client Secret is required'),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).min(1).optional(),
})

providerConfigRouter.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.providerConfig.findFirst({
      where: { OR: [{ userId: req.user!.id }, { userId: null }], provider: 'google_drive', status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    const callbackUrl = `${env.APP_URL}/connected-accounts/google/callback`

    if (!config) {
      return res.json({
        configured: false,
        redirectUri: callbackUrl,
        clientIdPreview: null,
      })
    }

    let clientIdPreview: string | null = null
    try {
      const rawId = decryptText(config.clientIdEncrypted)
      clientIdPreview = rawId.length > 12 ? `${rawId.slice(0, 6)}...${rawId.slice(-6)}` : rawId
    } catch {
      clientIdPreview = 'configured'
    }

    return res.json({
      configured: true,
      redirectUri: config.redirectUri || callbackUrl,
      clientIdPreview,
      id: config.id,
    })
  } catch (error) {
    return next(error)
  }
})

providerConfigRouter.post('/google', async (req: AuthRequest, res, next) => {
  try {
    const body = schema.parse(req.body)
    const redirectUri = body.redirectUri || `${env.APP_URL}/connected-accounts/google/callback`
    const scopes = body.scopes || defaultGoogleScopes

    // Upsert user's Google provider config
    const existing = await prisma.providerConfig.findFirst({
      where: { userId: req.user!.id, provider: 'google_drive' },
    })

    const config = existing
      ? await prisma.providerConfig.update({
          where: { id: existing.id },
          data: {
            clientIdEncrypted: encryptText(body.clientId),
            clientSecretEncrypted: encryptText(body.clientSecret),
            redirectUri,
            scopes: serializeJson(scopes),
            status: 'active',
          },
        })
      : await prisma.providerConfig.create({
          data: {
            userId: req.user!.id,
            provider: 'google_drive',
            clientIdEncrypted: encryptText(body.clientId),
            clientSecretEncrypted: encryptText(body.clientSecret),
            redirectUri,
            scopes: serializeJson(scopes),
            status: 'active',
          },
        })

    return res.status(201).json({
      id: config.id,
      provider: config.provider,
      redirectUri: config.redirectUri,
      scopes: parseStringArray(config.scopes),
      status: config.status,
    })
  } catch (error) {
    return next(error)
  }
})

providerConfigRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const configs = await prisma.providerConfig.findMany({
      where: { userId: req.user!.id },
      select: { id: true, provider: true, redirectUri: true, scopes: true, status: true, createdAt: true },
    })
    return res.json({
      configs: configs.map((config) => ({ ...config, scopes: parseStringArray(config.scopes) })),
    })
  } catch (error) {
    return next(error)
  }
})

providerConfigRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await prisma.providerConfig.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})
