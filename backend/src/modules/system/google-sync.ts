import { env } from '../../config/env.js'
import { prisma } from '../../config/prisma.js'
import { encryptText } from '../../utils/crypto.js'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

function isConfigured(value: string | undefined, placeholders: string[]) {
  if (!value?.trim()) return false
  return !placeholders.includes(value.trim())
}

/**
 * Automatically syncs Google OAuth credentials from backend/.env into ProviderConfig
 * if provided by the administrator or terminal setup command.
 */
export async function syncGoogleConfigFromEnv(): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${env.APP_URL.replace(/\/+$/, '')}/connected-accounts/google/callback`

  const hasClientId = isConfigured(clientId, ['your-google-client-id', 'your-client-id'])
  const hasClientSecret = isConfigured(clientSecret, ['your-google-client-secret', 'your-client-secret'])

  if (!hasClientId || !hasClientSecret) {
    return
  }

  const existing = await prisma.providerConfig.findFirst({
    where: { userId: null, provider: 'google_drive', status: 'active' },
  })

  if (!existing) {
    await prisma.providerConfig.create({
      data: {
        userId: null,
        provider: 'google_drive',
        clientIdEncrypted: encryptText(clientId!),
        clientSecretEncrypted: encryptText(clientSecret!),
        redirectUri,
        scopes: JSON.stringify(GOOGLE_SCOPES),
        status: 'active',
      },
    })
    console.log('[*] Seeded global Google Drive OAuth credentials from environment variables.')
  }
}
