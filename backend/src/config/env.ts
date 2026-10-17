import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const isProduction = process.env.NODE_ENV === 'production'

/**
 * SQLite is the default provider so that a fresh clone runs with no
 * configuration. `scripts/ensure-env.mjs` writes a .env with generated
 * secrets before `npm run dev`; production must supply them explicitly.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_PROVIDER: z.enum(['sqlite', 'mysql', 'postgres', 'postgresql']).default('sqlite'),
    DATABASE_URL: z.string().min(1).default('file:./dev.db'),

    APP_PORT: z.coerce.number().int().positive().default(4000),
    /** Public origin of this API. Used to build OAuth redirect URIs. */
    APP_URL: z.string().url().default('http://localhost:4000'),
    /** Public origin of the web app. Used for redirects after OAuth. */
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    /**
     * Comma-separated list of browser origins allowed to call this API.
     * Defaults to FRONTEND_URL alone.
     */
    CORS_ORIGINS: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32),
    TOKEN_ENCRYPTION_KEY: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

    /**
     * How many reverse proxies sit in front of this process.
     * `false` (the default) means req.ip is the socket address and
     * X-Forwarded-For is ignored. Setting this to `true` behind no proxy
     * lets any client forge their own IP, which would defeat rate limiting
     * and poison the audit log.
     */
    TRUST_PROXY: z
      .union([z.literal('true'), z.literal('false'), z.coerce.number().int().nonnegative()])
      .default('false')
      .transform((value) => (value === 'true' ? true : value === 'false' ? false : value)),

    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024 * 1024),
    /** Name of the folder created in each connected Drive account. */
    DRIVE_ROOT_FOLDER: z.string().min(1).max(64).default('BetterDrive'),

    /** Database restore replaces all data, so it is opt-in even for admins. */
    ALLOW_DB_RESTORE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    /** Registration is open unless disabled, e.g. for a single-user install. */
    ALLOW_REGISTRATION: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    RECAPTCHA_SECRET_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    SFTP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SFTP_HOST: z.string().default('0.0.0.0'),
    SFTP_PORT: z.coerce.number().int().positive().default(2222),
    SFTP_HOST_KEY_PATH: z.string().default('./data/sftp_host_ed25519'),
    SFTP_MAX_CONNECTIONS: z.coerce.number().int().positive().default(20),
    SFTP_USER_MAX_SESSIONS: z.coerce.number().int().positive().default(4),
    SFTP_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
    SFTP_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    SFTP_AUTH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(6),
    SFTP_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
    SFTP_SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(5000),
    SFTP_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

    INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    API_KEY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    API_KEY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  })
  .transform((value) => ({
    ...value,
    isProduction: value.NODE_ENV === 'production',
    corsOrigins: (value.CORS_ORIGINS ?? value.FRONTEND_URL)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  }))

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  console.error(`Invalid environment configuration:\n${issues}\n`)
  if (!isProduction) {
    console.error('For local development, run `npm run dev` from the repo root; it generates')
    console.error('backend/.env with working defaults. See .env.example for every option.')
  }
  process.exit(1)
}

export const env = parsed.data
