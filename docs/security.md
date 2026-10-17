# Security Architecture & Threat Model

This document outlines the defensive constraints, threat model, cryptographic algorithms, and attack surface mitigations implemented in BetterDrive.

---

## 1. Security Principles

BetterDrive is built around three defensive architectural tenets:
1. **Zero-Trust Network Boundaries**: All public listeners reject unauthenticated traffic. Interactive shell/PTY allocations are denied at the protocol negotiation layer.
2. **Confidentiality at Rest**: Cloud provider secrets, OAuth refresh tokens, and S3 credentials are encrypted with authenticated ciphers before database commitment.
3. **Defense in Depth**: Virtual filesystem paths are sandboxed, preventing directory traversal even in the presence of malformed client input.

---

## 2. Attack Surface Analysis

### 1. Web REST API Gateway (Port 4000)

- **Session Security**:
  - Ephemeral JSON Web Tokens (1-hour TTL) signed with `HS256`.
  - Refresh tokens are 256-bit cryptographically secure random values stored exclusively as SHA-256 hashes (`RefreshToken.tokenHash`).
  - Refresh tokens are isolated to `HttpOnly; SameSite=Lax; Secure` cookies, preventing credential extraction via client-side script injection.
- **Role-Based Access Control (RBAC)**:
  - Strict three-tier hierarchy: `owner`, `admin`, `member`.
  - All `/system/*` endpoints enforce `requireRole(['owner', 'admin'])`. Admin users cannot invite other admins (`INVITATION_ADMIN_REQUIRES_OWNER`).
  - Session revocation: Modifying a user's role, disabling their account, or updating their password immediately purges all active refresh tokens.
- **Input Sanitization**:
  - File IDs, folder IDs, and paths are validated with strict regex patterns before execution.
  - Public file sharing lookups query against SHA-256 hashes (`FileShare.tokenHash`), preventing enumeration attacks.

### 2. SFTP Gateway (Port 2222)

- **Key-Only Authentication**:
  - Accepts authorized `ssh-ed25519` and RSA public keys (`rsa-sha2-256`, `rsa-sha2-512`).
  - Password, keyboard-interactive, and `none` methods are rejected at the protocol layer.
- **Channel Restriction**:
  - Shell execution, exec commands, PTY allocation, and port forwarding are blocked.
  - Only the `sftp` subsystem channel is initialized.
- **VFS Path Sandboxing**:
  - Sessions are anchored to an authorized root directory (`allowedRoots`). Path resolution strips leading slashes and resolves relative segments (`..`).
  - Directory escape attempts return `SSH_FX_PERMISSION_DENIED` without leaking host filesystem paths.
- **Zero Key Leakage**:
  - Host keys are read from restricted host files. Audit logs record only key algorithms and SHA-256 key fingerprints. Private key material is never logged.

### 3. Cryptographic Storage & Encryption at Rest

- **Cipher**: `AES-256-GCM` authenticated symmetric encryption.
- **Key Derivation**: 32-byte secret loaded via `TOKEN_ENCRYPTION_KEY`.
- **Payload Format**: `iv:authTag:ciphertext` in hexadecimal string encoding.
- **Encrypted Model Fields**:
  - `ConnectedAccount.refreshToken` (Google Drive OAuth)
  - `ConnectedAccount.clientSecret` (Google Drive OAuth)
  - `ConnectedAccount.secretAccessKey` (AWS S3, Wasabi, Cloudflare R2)

### 4. Client-Side DOM Safety (XSS Immunity)

- **Text & Code Previews**:
  - Code and text previews in `<TextPreview />` render through safe raw text nodes or `textContent`. Untrusted file content is never rendered through `dangerouslySetInnerHTML`.
- **Zero External CDNs**:
  - Media players (Plyr) and syntax highlighters are bundled directly into the Vite build. Zero assets or fonts are loaded from third-party CDNs at runtime.
- **Local Avatars**:
  - Avatars are generated client-side from user initials, eliminating tracking calls or MD5 email queries to third-party services.

---

## 3. Vulnerability Reporting

Security vulnerabilities should be reported through GitHub Private Vulnerability Reporting or via email to `security@betterdrive.local`.

- **Initial Response**: Within 48 hours.
- **Remediation SLA**: Within 7 business days for verified high/critical reports.
