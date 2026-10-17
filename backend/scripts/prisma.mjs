#!/usr/bin/env node
/**
 * Prisma CLI wrapper that picks the schema matching DATABASE_PROVIDER.
 *
 *   DATABASE_PROVIDER=sqlite    prisma/schema.prisma            (default)
 *   DATABASE_PROVIDER=mysql     prisma/mysql/schema.prisma
 *   DATABASE_PROVIDER=postgres  prisma/postgres/schema.prisma
 *
 * Every provider keeps its migrations next to its own schema, which is how
 * Prisma resolves them. Without this wrapper each command would need an
 * explicit --schema flag, and npm scripts cannot expand environment
 * variables portably across bash and cmd.
 *
 *   node scripts/prisma.mjs migrate dev
 *   node scripts/prisma.mjs generate
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const SCHEMAS = {
  sqlite: 'prisma/schema.prisma',
  mysql: 'prisma/mysql/schema.prisma',
  postgres: 'prisma/postgres/schema.prisma',
  postgresql: 'prisma/postgres/schema.prisma',
}

const DEFAULT_URLS = {
  sqlite: 'file:./dev.db',
}

const provider = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase()
const schema = SCHEMAS[provider]

if (!schema) {
  console.error(
    `Unknown DATABASE_PROVIDER "${provider}". Expected one of: ${Object.keys(SCHEMAS).join(', ')}`,
  )
  process.exit(1)
}

if (!existsSync(join(backendDir, schema))) {
  // The SQLite and Postgres schemas are generated from the MySQL one. On a
  // fresh clone the backend `postinstall` runs before anything has generated
  // them, so do it here rather than failing the install.
  const sync = spawnSync('node', [join(backendDir, '..', 'scripts', 'sync-schemas.mjs')], {
    cwd: join(backendDir, '..'),
    stdio: 'inherit',
  })
  if (sync.status !== 0 || !existsSync(join(backendDir, schema))) {
    console.error(`Schema not found: ${schema}\nRun \`npm run schema:sync\` from the repo root.`)
    process.exit(1)
  }
}

// SQLite is meant to work with no configuration at all, so fill in a default
// file URL when the user has not written a .env yet.
const env = { ...process.env }
if (!env.DATABASE_URL && DEFAULT_URLS[provider]) {
  env.DATABASE_URL = DEFAULT_URLS[provider]
}

const args = process.argv.slice(2)

// Run Prisma's own entrypoint with this node binary: no PATH lookup, no npx,
// no shell (which on Windows would concatenate rather than escape arguments).
const manifestPath = require.resolve('prisma/package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.prisma
const entrypoint = join(dirname(manifestPath), bin)

const result = spawnSync(process.execPath, [entrypoint, ...args, '--schema', schema], {
  cwd: backendDir,
  stdio: 'inherit',
  env,
})

process.exit(result.status ?? 1)
