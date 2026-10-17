import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import fs from 'node:fs'
import { env } from './config/env.js'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js'
import {
  apiLimiter,
  authLimiter,
  publicTokenLimiter,
  registerLimiter,
  uploadLimiter,
} from './middleware/rate-limit.middleware.js'
import { adminRouter } from './modules/admin/admin.routes.js'
import { apiKeyRouter } from './modules/api-keys/api-key.routes.js'
import { auditLogRouter } from './modules/audit-logs/audit-log.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { meRouter } from './modules/auth/me.routes.js'
import { connectedAccountRouter } from './modules/connected-accounts/connected-account.routes.js'
import { accountRouter } from './modules/accounts/account.routes.js'
import { fileRouter } from './modules/files/file.routes.js'
import { folderRouter } from './modules/folders/folder.routes.js'
import { inviteRouter } from './modules/invites/invite.routes.js'
import { memberRouter } from './modules/members/member.routes.js'
import { publicInvitationRouter } from './modules/invitations/invitation.routes.js'
import { notificationRouter } from './modules/notifications/notification.routes.js'
import { providerConfigRouter } from './modules/provider-configs/provider-config.routes.js'
import { publicApiRouter } from './modules/public-api/public-api.routes.js'
import { publicRouter } from './modules/public/public.routes.js'
import { savedViewRouter } from './modules/saved-views/saved-view.routes.js'
import { storageRouter } from './modules/storage/storage.routes.js'
import { systemRouter } from './modules/system/system.routes.js'
import { uploadRouter } from './modules/uploads/upload.routes.js'
import { mascotRouter } from './modules/mascot/mascot.routes.js'
import { sftpAdminRouter, sftpUserRouter } from './sftp/sftp.routes.js'

export const app = express()

/**
 * How many proxies to trust for req.ip and X-Forwarded-For.
 *
 * Defaults to `false`. Trusting forwarded headers with no proxy in front
 * would let any client choose their own apparent IP, which would defeat every
 * rate limit and make the audit log's IP column meaningless.
 */
app.set('trust proxy', env.TRUST_PROXY)
app.disable('x-powered-by')

app.use(
  helmet({
    // The API serves JSON and file streams, never HTML of its own, so a
    // document CSP has nothing to protect here. Streamed user content gets
    // its own stricter policy in modules/files/stream-security.ts.
    contentSecurityPolicy: false,
    // Browsers must be able to read file streams from the web app's origin.
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  }),
)

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, the upload API) send no Origin.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`Origin ${origin} is not allowed by CORS_ORIGINS.`))
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges'],
  }),
)

app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Public surfaces. Rate limited because they are reachable without a session.
app.use('/api/v1/uploads', uploadLimiter)
app.use('/api', publicApiRouter)
app.use('/public', publicTokenLimiter, publicRouter)

app.use('/auth/register', registerLimiter)
app.use('/auth/login', authLimiter)
app.use('/auth/refresh', authLimiter)
app.use('/auth', authRouter)

// Authenticated surfaces.
app.use(apiLimiter)
app.use('/invitations', publicInvitationRouter)
app.use('/admin', adminRouter)
app.use('/api-keys', apiKeyRouter)
app.use('/provider-configs', providerConfigRouter)
app.use('/connected-accounts', accountRouter)
app.use('/connected-accounts', connectedAccountRouter)
app.use('/storage', storageRouter)
app.use('/uploads', uploadRouter)
app.use('/files', fileRouter)
app.use('/folders', folderRouter)
app.use('/saved-views', savedViewRouter)
app.use('/invites', inviteRouter)
app.use('/audit-logs', auditLogRouter)
app.use('/system/sftp', sftpAdminRouter)
app.use('/system/members', memberRouter)
app.use('/system/connected-accounts', accountRouter)
app.use('/system', systemRouter)
app.use('/me/api-keys', apiKeyRouter)
app.use('/me/notifications', notificationRouter)
app.use('/me/sftp', sftpUserRouter)
app.use('/me', meRouter)
app.use('/mascot', mascotRouter)

// In production or when frontend dist exists, serve the Single Page Application
const frontendDistCandidates = [
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
]
const frontendDistPath = frontendDistCandidates.find((candidate) => fs.existsSync(candidate))

if (frontendDistPath) {
  app.use(express.static(frontendDistPath))
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    // Let API and storage streaming endpoints pass to backend 404 handler
    const apiPrefixes = [
      '/api',
      '/auth',
      '/me',
      '/system',
      '/public',
      '/files',
      '/folders',
      '/storage',
      '/uploads',
      '/admin',
      '/invitations',
      '/invites',
      '/audit-logs',
      '/provider-configs',
      '/connected-accounts',
      '/mascot',
      '/health',
    ]
    if (apiPrefixes.some((p) => req.path.startsWith(p))) {
      return next()
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'))
  })
}

app.use(notFoundMiddleware)
app.use(errorMiddleware)
