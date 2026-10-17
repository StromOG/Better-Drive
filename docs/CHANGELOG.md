# Changelog

All notable changes to BetterDrive are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-10-17

### Added
- Instant folder scaling control (`XS | SM | MD | LG`) with zero-latency responsive layout engine.
- 36 offline vector icons for folder visuals (Lucide React) with zero external iconify CDN requests.
- Smart vault companion (Byte) with physics-based floating/docking, double-click live telemetry diagnostics, triple-click spotlight tour, and 1-time onboarding.
- Multi-environment developer terminal suite (.env, PowerShell CLI, Bash & cURL, AWS S3 CLI, Rclone Sync & Mount).
- 7 comprehensive cloud setup guides in a balanced responsive grid with copyable configurations.
- One-click binary SQLite snapshots and universal JSON schema vault backup/restore.
- Global browser focus outline hygiene eliminating harsh native Chrome focus rings.
- Direct routing to `/settings/accounts` for storage gateway initialization.
- Clean production setup: removed auto-generated `package-lock.json` from git tracking.

## [0.9.0] — 2026

### Added
- Multi-user collaboration: `Invitation` model and endpoints (`POST/GET/DELETE /system/members/invitations`) with 7-day cryptographic tokens and public acceptance (`POST /invitations/:token/accept`).
- Role-based member management: `GET /system/members`, `PATCH /system/members/:id/role`, and `DELETE /system/members/:id` with single and bulk operations, plus session revocation on disable.
- Connected accounts lifecycle: inline label updates and enabled toggle (`PATCH /system/connected-accounts/:id`), reauthentication flow, health diagnostics, and graceful disconnection preserving files in read-only status.
- Account Switcher: header dropdown for instant switching between pooled view and account-scoped view (`?account=<id>`) with dynamic breadcrumb reflection.
- Advanced search filters: collapsible filter panel supporting MIME kinds (photo, video, audio, document, archive, code, other), size presets, date presets, and connected account scoping.
- Modular settings architecture: lazy-loaded sub-pages for `/settings/profile`, `/settings/members`, `/settings/accounts`, `/settings/api-keys`, and `/settings/notifications`.
- Personal settings: profile updates, verified email changes, password modification, and self-service account deletion (`/me/*`).
- Programmatic API keys: self-service Bearer token provisioning with SHA-256 hash persistence and instant revocation.
- Notification preferences: granular in-app alert controls across upload, storage, and team events.
- Database migrations: added `Invitation` and `NotificationPreference` models, `ApiKey.label`, and `ConnectedAccount` `enabled` / `revokedAt` columns across SQLite, PostgreSQL, and MySQL.
- SFTP gateway server: SSH2-based port-2222 gateway with zero-trust public key authentication (Ed25519 and RSA).
- Database migrations for `sftp_access_profiles`, `sftp_authorized_keys`, and `sftp_session_logs` across SQLite, PostgreSQL, and MySQL.
- Verified streaming VFS upload path with real wire 100 MB benchmark over ephemeral port (RSS delta < 200 MB, stream hash verification).
- Automated audit trail recording session events with SHA-256 key fingerprints, sanitized paths, and zero key/content leakage.
- Deduplication: Model B rejection scoped to matching filename, checksum, and target parent folder (`DUPLICATE_CONTENT` 409).
- Text preview: safe plaintext rendering for text and code files via `<TextPreview />` with component-level DOM XSS immunity testing (Vitest + jsdom).

## [0.1.0] — 2025

Initial release — hardened fork of [9Drive](https://github.com/zenhosta/9drive) by Zenhosta (Apache-2.0).

### Security
- Removed `POST /system/update` — any authenticated user could execute `bash update.sh` or `git pull` on the server
- `GET /system/backup`, `POST /system/restore`, `POST /system/google-config` now require admin or owner role
- Refresh token moved to `HttpOnly; SameSite=Lax; Secure` cookie — eliminates XSS access-token-theft path that existed via localStorage
- `FileShare.token` (plaintext share token stored in DB) removed — share lookup is now hash-only
- `GET /files/:id/view-url` no longer grants `role:writer, type:anyone` on the Google Drive file as a side-effect of reading it
- Upload routes no longer call `drive.permissions.create(writer/anyone)` on every uploaded file
- `trust proxy` is now configurable via `TRUST_PROXY` env (was hardcoded `true`, allowing `X-Forwarded-For` spoofing and defeating rate-limiting)
- Redirect URI for OAuth derived from `APP_URL` env (was `req.get('host')`, host-header injectable)
- Plyr loaded from local npm package; removed cdnjs CDN call with no SRI
- Avatar generation is local (initials); removed SHA-256 email leakage to gravatar.com and dicebear.com
- `error.middleware` no longer returns raw internal error messages to clients

### Changed from upstream
- Database: SQLite by default (zero config); MySQL and Postgres supported via separate schema files
- Role system (`owner` | `admin` | `member`) added to User; first registered account becomes owner
- `Json` Prisma columns converted to `String` (JSON text) for SQLite compatibility
- Tailwind CSS `!important` override sheet (413 lines) replaced with `@theme` token system
- Google Fonts request removed; system font stack with tabular-nums
- Plyr replaced with native `<video controls>` for audio/video preview (zero dependency bytes for most users)
- `DRIVE_ROOT_FOLDER` env controls the Drive folder name (was hardcoded `9drive`)
- `CORS_ORIGINS` accepts a comma-separated allowlist (was single `FRONTEND_URL`)

### Added
- `File.starred` + `File.starredAt` — star/unstar, `GET /files/starred`
- `File.checksum` — SHA-256 computed during upload stream; duplicate detection
- `GET /files/recent` — real recent files ordered by `updatedAt`, grouped by date
- Command palette (`Cmd+K` / `Ctrl+K`)
- Keyboard shortcuts: `/` search, `j/k` navigate, `x` select, `Del` trash, `?` help sheet
- Multi-select with shift-click and Cmd-click; bulk move/star/trash/download
- Batch zip download — `POST /files/batch/download`
- Breadcrumbs with drag-to-move
- Storage health indicator (pre-upload quota warnings)
- Admin panel at `/admin` — user roles, OAuth config, audit log, backup/restore
- Real `NotFoundPage` at `*` route (was silent redirect to `/all-files`)
- `GET /system/config` — returns real `dbProvider`, `maxUploadBytes`, `driveRootFolder`, `version`

### Removed
- `POST /system/update` (unauthenticated remote code execution)
- `GET /system/update-log`
- `ArchivedPage` (rendered mock data, duplicated Trash)
- `frontend/src/counter.ts`, `frontend/src/data/drive-data.ts`
- `setup.ps1`, `setup.sh` (replaced by workspace npm scripts)
- `lib/plyr.ts` (CDN loader), `lib/gravatar.ts`

### Upstream databases
9Drive databases (MySQL) are **not** automatically migrated to BetterDrive. See README for manual migration guidance.
