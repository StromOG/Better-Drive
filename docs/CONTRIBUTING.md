# Contributing to BetterDrive

BetterDrive is a hardened fork of [9Drive](https://github.com/zenhosta/9drive) by Zenhosta, licensed under Apache-2.0.

## Development Setup

```bash
git clone https://github.com/StromOG/Better-Drive.git
cd better-drive
npm install
npm run setup
npm run dev
```

BetterDrive defaults to SQLite in WAL mode (`backend/prisma/dev.db`). No external database daemon or container is required for local development.

## Quality Standards & Verification

Before submitting a pull request, run:

```bash
npm run verify
```

`npm run verify` runs:
1. Database schema parity check across SQLite, PostgreSQL, and MySQL (`npm run schema:check`)
2. ESLint across frontend and backend (`npm run lint`)
3. TypeScript compiler check (`npm run typecheck`)
4. Backend test suite (`npm run test:backend`)
5. Frontend Vitest suite including XSS immunity testing (`npm run test:frontend`)
6. SFTP gateway integration test suite (`npm run test:sftp`)
7. Full production build of backend and frontend (`npm run build`)

## Code Conventions

- **Express route handlers**: Follow `async (req, res, next) => { try { ... } catch (e) { next(e) } }`. Error codes use `SCREAMING_SNAKE_CASE`. Errors passed to `next()` are classified by `error.middleware.ts`.
- **Frontend API calls**: Use `apiFetch` for all JSON endpoints. Use raw `fetch` or `XMLHttpRequest` only for binary streams, file downloads, or upload progress monitoring.
- **Session handling**: Access tokens live in memory/React state; refresh tokens are stored in `HttpOnly; SameSite=Lax; Secure` cookies. Never write access tokens to `localStorage` or `sessionStorage`.
- **Styling**: All styles consume `@theme` tokens or CSS custom properties. Zero `!important` rules in `frontend/src`.
- **Assets & Privacy**: No external runtime requests to third-party CDNs without Subresource Integrity (SRI) and local fallbacks. Avatars are generated locally from user initials without transmitting email hashes to third-party services.

## Anti-Slop Checklist

Every pull request must comply with the following hygiene checklist:

- [ ] **No marketing hyperbole**: Prohibited terms include "revolutionary", "cutting-edge", "seamless", "empower", "unlock", "delve", "elevate", "blazing", "effortless", and unmeasured multipliers (e.g. "5x").
- [ ] **Verifiable numbers**: Any performance claim or metric must have reproducible benchmark tooling in `scripts/`.
- [ ] **No emoji in documentation headers or feature lists**: Keep headings and bullet points factual and plain.
- [ ] **No redundant comments**: Comments must explain non-obvious invariants or hardware/protocol quirks, not restate code or narrate intent.
- [ ] **No commented-out code**: Dead code must be deleted, not commented out.
- [ ] **No production console logging**: Use the backend structured logger. `console.log` on production paths is banned.
- [ ] **No unjustified `any`**: Type every value, or provide a one-line comment explaining why type narrowing is impossible.
- [ ] **No useless async/await or try/catch**: Do not mark functions `async` if they never `await`. Do not catch and re-throw unchanged errors.
- [ ] **Real screenshots**: Documentation images must be captured directly from a running demo instance. No Figma exports, mockups, or stock photography.

## Security Vulnerabilities

Do not open public GitHub issues for security vulnerabilities. Review [SECURITY.md](SECURITY.md) for reporting procedures and disclosure timelines.

## License

By contributing to BetterDrive, you agree that your contributions are licensed under the Apache-2.0 license. Significant logic ported from upstream 9Drive must cite original attribution in accordance with the `NOTICE` file.
