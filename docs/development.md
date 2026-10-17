# Development & Contribution Guide

This guide details the local development setup, architectural conventions, test suites, and multi-database schema synchronization procedures for BetterDrive.

---

## 1. Prerequisites

- **Node.js**: `20.x` or later
- **npm**: `10.x` or later
- **Supported OS**: Windows 10/11, macOS, Linux

---

## 2. Local Setup

```bash
git clone https://github.com/zenhosta/better-drive.git
cd better-drive
npm install
npm run setup
npm run dev
```

BetterDrive boots with SQLite in WAL mode (`backend/prisma/dev.db`). No external database daemon or container is required for local engineering.

### Active Ports:
- **Web Interface**: `http://localhost:5173` (Vite dev server)
- **REST API**: `http://localhost:4000` (Express daemon)
- **SFTP Gateway**: `localhost:2222` (SSH2 server)

---

## 3. Workspace Scripts

All repository commands match `package.json` definitions:

| Command | Action |
|---|---|
| `npm run dev` | Launch backend and frontend concurrently in development mode |
| `npm run build` | Compile backend TypeScript and build Vite production bundle |
| `npm run typecheck` | Execute TypeScript compiler checks across all workspaces |
| `npm run lint` | Run ESLint across backend and frontend codebases |
| `npm run test:backend` | Execute Node.js native test runner on backend suites |
| `npm run test:frontend` | Execute Vitest suites (components, hooks, XSS safety) |
| `npm run test:sftp` | Execute 100 MB SFTP streaming benchmarks and protocol tests |
| `npm run verify` | Run full CI verification pipeline (`schema:check`, `lint`, `typecheck`, all tests, `build`) |
| `npm run schema:sync` | Propagate canonical SQLite schema to PostgreSQL and MySQL schemas |
| `npm run schema:check` | Verify schema parity across SQLite, PostgreSQL, and MySQL |

---

## 4. Multi-Database Schema Parity

BetterDrive maintains schema definitions for SQLite, PostgreSQL, and MySQL.

The canonical schema is `backend/prisma/schema.prisma` (SQLite). When modifying models:
1. Make changes to `backend/prisma/schema.prisma`.
2. Run `npm run schema:sync` to generate matching PostgreSQL and MySQL schemas:
   - `backend/prisma/postgres/schema.prisma`
   - `backend/prisma/mysql/schema.prisma`
3. Run `npm run schema:check` to verify that all relations, columns, and indexes match with zero drift.

---

## 5. Automated Test Suites

### Backend Test Suites (`backend/tests/`)
- `tests/members/members.spec.ts`: Team invitations, token hashing, expiration, role hierarchy (`owner`/`admin`/`member`), bulk actions.
- `tests/accounts/accounts.spec.ts`: Connected account management, inline renaming, enable/disable toggling, health checks.
- `tests/api-keys/api-keys.spec.ts`: Programmatic API key generation, SHA-256 hash validation, Bearer auth, revocation.
- `tests/notifications/notifications.spec.ts`: Notification preferences matrix and preference updates.
- `tests/uploads/dedup.spec.ts`: Inline SHA-256 stream deduplication and `409 DUPLICATE_CONTENT` enforcement.
- `tests/files/cleanup.spec.ts`: Retention policies, trash bin lifecycle, soft-deletion.
- `tests/preview/preview.spec.ts`: Tokenized preview streams, range queries, MIME kind detection.
- `tests/sftp/sftp.spec.ts`: Public key auth, jailed path traversal rejection, 100 MB stream benchmark.

### Frontend Test Suites (`frontend/src/`)
- `TextPreview.test.tsx`: XSS prevention tests verifying that dangerous HTML strings (`<script>`, `<img onerror>`) are rendered as raw text nodes.
- `AccountSwitcher.test.tsx`: Header account dropdown, single-account filtering, pooled view resets.
- `ConfirmationDialog.test.tsx`: Accessible modal dialogues, keyboard trap, and confirm actions.
- `ApiKeyModal.test.tsx`: Key label provisioning, secret display, and clipboard copy.

---

## 6. Demo Instance Seeding

To seed a local database with realistic multi-cloud accounts, team members, and diverse file categories:

```bash
node scripts/seed-demo.mjs
```

Default seeded credentials:
- **Email**: `demo@betterdrive.local`
- **Password**: `DemoPassword2026!`
- **Role**: `owner`
- **Accounts**: 2 Google Drive accounts (15 GB + 100 GB) + 1 Wasabi S3 bucket (500 GB)
