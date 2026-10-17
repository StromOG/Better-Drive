import rateLimit, { type Options } from 'express-rate-limit'
import type { Request } from 'express'
import { env } from '../config/env.js'

/**
 * Rate limits for the endpoints an unauthenticated caller can reach.
 *
 * These depend on `req.ip` being trustworthy, which is why TRUST_PROXY
 * defaults to `false`: behind no proxy, honouring X-Forwarded-For would let
 * any client rotate their apparent address and bypass every limit here.
 */

function limiter(options: Partial<Options> & Pick<Options, 'limit' | 'windowMs'>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: false,
    // The default handler returns plain text; the API is JSON everywhere else.
    handler: (_req, res) =>
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment and try again.',
      }),
    ...options,
  })
}

/** Keys by submitted email as well as IP so one address cannot spray accounts. */
function emailAndIpKey(req: Request) {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ''
  return `${req.ip ?? 'unknown'}:${email}`
}

/** Password guessing and account enumeration. */
export const authLimiter = limiter({
  windowMs: 15 * 60_000,
  limit: env.isProduction ? 10 : 100,
  keyGenerator: emailAndIpKey,
  skipSuccessfulRequests: true,
})

/** Account creation, which is more expensive than a login (argon2 hashing). */
export const registerLimiter = limiter({
  windowMs: 60 * 60_000,
  limit: env.isProduction ? 5 : 100,
})

/** Share and preview tokens are random, but without a limit they are enumerable. */
export const publicTokenLimiter = limiter({
  windowMs: 5 * 60_000,
  limit: env.isProduction ? 60 : 1000,
})

/** Uploads via API key. Generous: legitimate batch uploads are bursty. */
export const uploadLimiter = limiter({
  windowMs: 60_000,
  limit: env.isProduction ? 60 : 1000,
})

/** Whole-database reads and writes. Deliberately very low. */
export const adminSensitiveLimiter = limiter({
  windowMs: 60 * 60_000,
  limit: 10,
})

/** Catch-all ceiling for authenticated API traffic. */
export const apiLimiter = limiter({
  windowMs: 60_000,
  limit: env.isProduction ? 600 : 10_000,
})
