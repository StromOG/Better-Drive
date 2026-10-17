#!/usr/bin/env node
/**
 * Generates the SQLite and Postgres Prisma schemas from the MySQL schema.
 *
 * The three schemas must stay structurally identical; only the datasource
 * block and MySQL's `@db.*` native type attributes differ. Rather than ask
 * humans to keep three 400-line files in sync by hand, the MySQL schema is
 * the single source of truth and the other two are derived from it:
 *
 *   backend/prisma/mysql/schema.prisma      source of truth
 *   backend/prisma/schema.prisma            SQLite, generated (default)
 *   backend/prisma/postgres/schema.prisma   Postgres, generated
 *
 *   node scripts/sync-schemas.mjs           rewrite the derived schemas
 *   node scripts/sync-schemas.mjs --check   fail if they are out of date (CI)
 *
 * Why MySQL is the source: it is the only provider whose column types cannot
 * be inferred. Dropping `@db.Text` there would silently truncate encrypted
 * tokens at VARCHAR(191). SQLite and Postgres need no attributes at all.
 *
 * Each schema sits in its own directory because Prisma resolves migrations as
 * `<schema dir>/migrations` — sharing a directory would mean sharing
 * migrations, which cannot work across providers.
 *
 * Output is passed through `prisma format` so the committed files are aligned
 * the same way a hand-written schema would be.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const prismaDir = join(root, 'backend', 'prisma')
const source = join(prismaDir, 'mysql', 'schema.prisma')
const check = process.argv.includes('--check')

const targets = [
  {
    file: join(prismaDir, 'schema.prisma'),
    provider: 'sqlite',
    note: 'SQLite — the default provider. Needs no DATABASE_URL and no database server.',
  },
  {
    file: join(prismaDir, 'postgres', 'schema.prisma'),
    provider: 'postgresql',
    note: 'PostgreSQL. `String` maps to TEXT, so no native type attributes are needed.',
  },
]

function derive(mysql, provider, note) {
  const models = mysql
    .slice(mysql.indexOf('\nmodel '))
    // MySQL native type attributes have no SQLite/Postgres equivalent.
    .replace(/[ \t]+@db\.[A-Za-z]+(\(\d+\))?/g, '')
    // Normalise alignment padding; `prisma format` re-aligns afterwards.
    .replace(/^(\s+[\w"[\]]+)[ \t]{2,}/gm, '$1 ')
    .trim()

  return `// Better Drive — ${provider} schema.
//
// GENERATED FILE. Do not edit directly.
// Edit prisma/mysql/schema.prisma and run \`npm run schema:sync\`.
//
// ${note}

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

${models}
`
}

/**
 * Resolves Prisma's own JS entrypoint so we can run it with the current node
 * binary. Avoids depending on PATH, on `npx`, and on a shell.
 */
function prismaEntrypoint() {
  try {
    const require = createRequire(join(root, 'backend', 'package.json'))
    const manifestPath = require.resolve('prisma/package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.prisma
    return bin ? join(dirname(manifestPath), bin) : null
  } catch {
    return null
  }
}

const prisma = prismaEntrypoint()

function format(file) {
  if (!prisma) return false
  try {
    execFileSync(process.execPath, [prisma, 'format', '--schema', file], {
      cwd: join(root, 'backend'),
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

function read(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

let unformatted = false
let outOfDate = false

for (const { file, provider, note } of targets) {
  const label = relative(root, file)
  const generated = derive(readFileSync(source, 'utf8'), provider, note)

  // Format in a scratch file so --check never mutates a committed schema.
  const scratch = `${file}.tmp`
  writeFileSync(scratch, generated)
  if (!format(scratch)) unformatted = true
  const next = readFileSync(scratch, 'utf8')
  rmSync(scratch, { force: true })

  if (read(file) === next) {
    console.log(`ok           ${label}`)
  } else if (check) {
    console.error(`out of date  ${label}`)
    outOfDate = true
  } else {
    writeFileSync(file, next)
    console.log(`written      ${label}`)
  }
}

if (unformatted) {
  console.warn('\nnote: `prisma format` was unavailable, so output is normalised but not aligned.')
  console.warn('Run `npm install` first for aligned output.')
}

if (outOfDate) {
  console.error('\nDerived schemas do not match schema.mysql.prisma. Run: npm run schema:sync')
  process.exit(1)
}
