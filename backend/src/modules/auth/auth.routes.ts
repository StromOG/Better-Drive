import { Router, type CookieOptions, type Response } from 'express'
import { google } from 'googleapis'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { hashPassword, verifyPassword } from '../../utils/password.js'
import { encryptText, hashToken, randomToken } from '../../utils/crypto.js'
import { signAccessToken } from '../../utils/jwt.js'
import { parseStringArray, serializeJson } from '../../utils/json-column.js'
import { createAuditLog } from '../../utils/audit.js'
import { createOAuthClient, syncGoogleQuota } from '../google/google.service.js'
import { getMascotSettings, updateMascotSettings } from '../mascot/mascot.service.js'

export const authRouter = Router()

const REFRESH_COOKIE = 'bd_refresh'

/**
 * The refresh token lives in an httpOnly cookie; the short-lived access token
 * is returned in the response body and held in memory by the web app.
 *
 * Upstream kept both tokens in localStorage, where any script running on the
 * page could read them. Every endpoint other than /auth/refresh still
 * authenticates with the Bearer access token rather than the cookie, so
 * moving the refresh token into a cookie does not open a CSRF surface: a
 * cross-site request cannot read the access token out of the response.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // Derived from the configured origin so plain-HTTP self-hosted installs
    // still work, while any https deployment gets the Secure flag.
    secure: env.APP_URL.startsWith('https://'),
    path: '/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  }
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions())
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined })
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(256),
  captchaToken: z.string().optional(),
})
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})
const googleExchangeSchema = z.object({ token: z.string().min(1) })

/**
 * The first account created owns the installation; everyone after is a member
 * an owner can promote. Without this nobody could reach the admin surfaces on
 * a fresh install.
 */
async function roleForNewUser() {
  const existing = await prisma.user.count()
  return existing === 0 ? 'owner' : 'member'
}

async function assertRegistrationAllowed() {
  if (env.ALLOW_REGISTRATION) return
  // The owner must always be able to create the first account, even with
  // registration closed.
  if ((await prisma.user.count()) === 0) return
  throw HttpError.forbidden(
    'Registration is closed on this installation.',
    'REGISTRATION_CLOSED',
  )
}

async function createSession(userId: string, req: AuthRequest, res: Response) {
  const refreshToken = randomToken()
  const session = await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: req.header('User-Agent')?.slice(0, 512),
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  setRefreshCookie(res, refreshToken)
  return signAccessToken({ sub: userId, sid: session.id })
}

async function publicUser(user: { id: string; name: string; email: string; role: string; status?: string }) {
  let avatarUrl: string | undefined
  try {
    const settings = await getMascotSettings(user.id)
    if (settings?.avatarUrl) {
      avatarUrl = settings.avatarUrl
    } else {
      const connected = await prisma.connectedAccount.findFirst({
        where: { userId: user.id, avatarUrl: { not: null } },
        select: { avatarUrl: true },
      })
      if (connected?.avatarUrl) avatarUrl = connected.avatarUrl
    }
  } catch {
    // fallback
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatarUrl }
}

async function verifyCaptcha(token: string | undefined) {
  if (!env.RECAPTCHA_SECRET_KEY) return true
  if (!token) return false
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token }),
  })
  const data = (await response.json()) as { success?: boolean }
  return Boolean(data.success)
}

authRouter.get('/setup-status', async (_req, res, next) => {
  try {
    const userCount = await prisma.user.count()
    return res.json({
      needsOwner: userCount === 0,
      allowRegistration: env.ALLOW_REGISTRATION,
      userCount,
    })
  } catch (error) {
    return next(error)
  }
})

authRouter.post('/register', async (req: AuthRequest, res, next) => {
  try {
    await assertRegistrationAllowed()
    const body = registerSchema.parse(req.body)

    const isFirstUser = (await prisma.user.count()) === 0
    if (!isFirstUser && !(await verifyCaptcha(body.captchaToken))) {
      throw HttpError.badRequest('Captcha verification failed.', 'CAPTCHA_FAILED')
    }
    if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
      throw HttpError.conflict('That email is already registered.', 'AUTH_EMAIL_TAKEN')
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        role: isFirstUser ? 'owner' : 'member',
      },
    })

    const accessToken = await createSession(user.id, req, res)
    await createAuditLog(user.id, 'auth.registered', 'user', user.id, { ip: req.ip })
    return res.status(201).json({ accessToken, user: await publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

authRouter.post('/login', async (req: AuthRequest, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })

    // One message for "no such user" and "wrong password" so the endpoint
    // cannot be used to tell which emails have accounts.
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new HttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.')
    }
    if (user.status !== 'active') {
      throw HttpError.forbidden('This account has been disabled.', 'AUTH_ACCOUNT_DISABLED')
    }

    const accessToken = await createSession(user.id, req, res)
    return res.json({ accessToken, user: await publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

authRouter.get('/google/url', async (_req, res, next) => {
  try {
    let config = await prisma.providerConfig.findFirst({
      where: { provider: 'google_drive', status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    if (!config && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      config = await prisma.providerConfig.create({
        data: {
          provider: 'google_drive',
          status: 'active',
          clientIdEncrypted: encryptText(env.GOOGLE_CLIENT_ID),
          clientSecretEncrypted: encryptText(env.GOOGLE_CLIENT_SECRET),
          redirectUri: `${env.APP_URL}/auth/google/callback`,
          scopes: serializeJson([
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive',
          ]),
        },
      })
    }

    if (!config) {
      return res.json({
        configured: false,
        url: null,
        message: 'Google Sign-In is not configured on this installation.',
      })
    }

    const state = randomToken()
    await prisma.oauthState.create({
      data: {
        providerConfigId: config.id,
        flow: 'login',
        stateHash: hashToken(state),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    })

    const url = createOAuthClient(config).generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: parseStringArray(config.scopes),
      state,
    })
    return res.json({ configured: true, url })
  } catch (error) {
    return next(error)
  }
})

authRouter.get('/google/callback', async (req, res) => {
  const fail = (reason: string) =>
    res.redirect(`${env.FRONTEND_URL}/google-auth?status=error&reason=${reason}`)

  try {
    const query = z.object({ code: z.string(), state: z.string() }).parse(req.query)
    const oauthState = await prisma.oauthState.findUnique({
      where: { stateHash: hashToken(query.state) },
      include: { providerConfig: true },
    })
    if (!oauthState || oauthState.flow !== 'login' || oauthState.usedAt || oauthState.expiresAt < new Date()) {
      return fail('state')
    }

    const client = createOAuthClient(oauthState.providerConfig)
    const { tokens } = await client.getToken(query.code)
    if (!tokens.access_token) return fail('token')
    client.setCredentials(tokens)

    const profile = await google.oauth2({ version: 'v2', auth: client }).userinfo.get()
    const providerAccountId = profile.data.id
    const email = profile.data.email?.toLowerCase()
    if (!providerAccountId || !email) return fail('profile')

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!existingUser) {
      // Google sign-in creates accounts, so it has to respect the same gate
      // as the email form.
      try {
        await assertRegistrationAllowed()
      } catch {
        return fail('registration_closed')
      }
    }

    const scopes = parseStringArray(oauthState.providerConfig.scopes)
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: profile.data.name || email.split('@')[0] || 'Google User',
        // Unusable local password: this account signs in through Google.
        passwordHash: await hashPassword(randomToken(32)),
        role: await roleForNewUser(),
      },
      update: { name: profile.data.name || undefined },
    })

    if (user.status !== 'active') return fail('disabled')

    const key = {
      userId_provider_providerAccountId: {
        userId: user.id,
        provider: 'google_drive',
        providerAccountId,
      },
    }
    const existingAccount = await prisma.connectedAccount.findUnique({ where: key })
    // Google only returns a refresh token on first consent, so keep the one
    // already stored when it is absent.
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : existingAccount?.refreshTokenEncrypted
    if (!refreshTokenEncrypted) return fail('refresh_token')

    const accountFields = {
      providerConfigId: oauthState.providerConfigId,
      email,
      displayName: profile.data.name,
      avatarUrl: profile.data.picture,
      accessTokenEncrypted: encryptText(tokens.access_token),
      refreshTokenEncrypted,
      tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      scopes: serializeJson(scopes),
      status: 'connected',
      lastError: null,
    }

    const account = await prisma.connectedAccount.upsert({
      where: key,
      create: { userId: user.id, provider: 'google_drive', providerAccountId, ...accountFields },
      update: accountFields,
    })

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date(), userId: user.id },
    })
    await syncGoogleQuota(account.id).catch(() => undefined)

    // A one-time handoff token: app tokens must never travel in a URL, where
    // they would land in browser history, logs and Referer headers.
    const handoffToken = randomToken()
    await prisma.authHandoff.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(handoffToken),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    })
    return res.redirect(`${env.FRONTEND_URL}/google-auth?token=${handoffToken}`)
  } catch (error) {
    console.error('Google sign-in callback failed:', error)
    return fail('unexpected')
  }
})

authRouter.post('/google/exchange', async (req: AuthRequest, res, next) => {
  try {
    const body = googleExchangeSchema.parse(req.body)
    const handoff = await prisma.authHandoff.findFirst({
      where: { tokenHash: hashToken(body.token), usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    })
    if (!handoff) {
      throw new HttpError(401, 'AUTH_GOOGLE_HANDOFF_INVALID', 'Google sign-in session expired.')
    }

    await prisma.authHandoff.update({ where: { id: handoff.id }, data: { usedAt: new Date() } })
    const accessToken = await createSession(handoff.userId, req, res)
    return res.json({ accessToken, user: await publicUser(handoff.user) })
  } catch (error) {
    return next(error)
  }
})

authRouter.post('/refresh', async (req: AuthRequest, res, next) => {
  try {
    const token =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined)
    if (typeof token !== 'string' || !token) {
      throw new HttpError(401, 'AUTH_SESSION_EXPIRED', 'No active session.')
    }

    const session = await prisma.userSession.findFirst({
      where: { refreshTokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, user: { select: { status: true } } },
    })
    if (!session) {
      clearRefreshCookie(res)
      throw new HttpError(401, 'AUTH_SESSION_EXPIRED', 'Session expired. Please sign in again.')
    }
    if (session.user.status !== 'active') {
      clearRefreshCookie(res)
      throw HttpError.forbidden('This account has been disabled.', 'AUTH_ACCOUNT_DISABLED')
    }

    // Rotate on every refresh: a replayed older token no longer matches the
    // stored hash, so a leaked one has a single-use window.
    const nextToken = randomToken()
    await prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: hashToken(nextToken), ipAddress: req.ip },
    })
    setRefreshCookie(res, nextToken)

    return res.json({ accessToken: signAccessToken({ sub: session.userId, sid: session.id }) })
  } catch (error) {
    return next(error)
  }
})

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await prisma.userSession.update({
      where: { id: req.user!.sessionId },
      data: { revokedAt: new Date() },
    })
    clearRefreshCookie(res)
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

/** Revokes every session for the caller, e.g. after a suspected compromise. */
authRouter.post('/logout-all', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { count } = await prisma.userSession.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    clearRefreshCookie(res)
    await createAuditLog(req.user!.id, 'auth.sessions_revoked', 'user', req.user!.id, {
      count,
      ip: req.ip,
    })
    return res.json({ status: 'ok', revoked: count })
  } catch (error) {
    return next(error)
  }
})

authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
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
    return res.json({ user: await publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  gravatarEnabled: z.boolean().optional(),
  avatarUrl: z.string().max(300000).optional(),
})

/** Lets a user rename themselves, change avatar, and opt into Gravatar. */
authRouter.patch('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const body = profileSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: body.name, gravatarEnabled: body.gravatarEnabled },
      select: { id: true, name: true, email: true, role: true, status: true, gravatarEnabled: true },
    })
    if (body.avatarUrl !== undefined) {
      await updateMascotSettings(req.user!.id, { avatarUrl: body.avatarUrl })
    }
    return res.json({ user: await publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.').max(256),
})

authRouter.post('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const body = passwordSchema.parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw HttpError.badRequest('Current password is incorrect.', 'AUTH_INVALID_CREDENTIALS')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(body.newPassword) },
      }),
      // Changing a password should end sessions elsewhere, but not this one.
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

/** Active sessions, so a user can see where they are signed in. */
authRouter.get('/sessions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return res.json({
      sessions: sessions.map((session) => ({
        ...session,
        current: session.id === req.user!.sessionId,
      })),
    })
  } catch (error) {
    return next(error)
  }
})

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1),
  newEmail: z.string().trim().toLowerCase().email(),
})

authRouter.post('/change-email', requireAuth, async (req: AuthRequest, res, next) => {
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
    return res.json({ status: 'ok', user: await publicUser(updated) })
  } catch (error) {
    return next(error)
  }
})

const deleteAccountSchema = z.object({
  password: z.string().min(1),
})

authRouter.delete('/account', requireAuth, async (req: AuthRequest, res, next) => {
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
    clearRefreshCookie(res)
    await createAuditLog(user.id, 'auth.account_deleted', 'user', user.id, { ip: req.ip })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

