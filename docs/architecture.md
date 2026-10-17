# Architecture & Virtual Filesystem Specification

BetterDrive is a multi-cloud storage gateway and virtual filesystem (VFS) that aggregates independent Google Drive accounts and S3-compatible object storage buckets into a single, unified storage pool. It operates as a local or self-hosted daemon that provides web, REST API, and SFTP interfaces to distributed cloud backends.

---

## 1. System Topology

```text
                           +-------------------------------------+
                           |      Web UI / Native SFTP Clients    |
                           +------------------+------------------+
                                              |
                                HTTP / WebSocket / SSH2
                                              v
+---------------------------------------------------------------------------------+
| BetterDrive Gateway Node                                                        |
|                                                                                 |
|   +------------------------------------+     +-------------------------------+  |
|   | Express REST API (:4000)           |     | SFTP Gateway (:2222)          |  |
|   | - Cookie-backed session manager    |     | - SSH2 Public Key Auth Only   |  |
|   | - Role-based authorization guard   |     | - Streaming VFS translation   |  |
|   | - In-memory upload routing pool    |     | - Jailed root sandbox         |  |
|   | - File preview & stream pipelines  |     | - Key fingerprint audit logs  |  |
|   +-----------------+------------------+     +---------------+---------------+  |
|                     |                                        |                  |
|                     +-------------------+--------------------+                  |
|                                         |                                       |
|                                         v                                       |
|   +-------------------------------------------------------------------------+   |
|   | Storage Allocation Router & Virtual Filesystem (VFS)                    |   |
|   | - SQLite (WAL mode default) / PostgreSQL / MySQL                        |   |
|   | - AES-256-GCM secret cipher at rest                                     |   |
|   | - Zero-buffer streaming pipeline                                        |   |
|   | - SHA-256 duplicate content detection                                   |   |
|   +-------------------------------------+-----------------------------------+   |
+-----------------------------------------|---------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+-------------------------------+                   +-------------------------------+
| Google Drive Provider Layer   |                   | S3 Object Storage Layer       |
| - OAuth2 PKCE token lifecycle |                   | - AWS S3, Wasabi, MinIO,      |
| - Resumable chunk streaming   |                   |   Cloudflare R2, Backblaze B2 |
| - Quota telemetry polling     |                   | - Multipart upload streams    |
+-------------------------------+                   +-------------------------------+
```

---

## 2. Virtual Filesystem (VFS) Layer

The VFS decouples logical file paths from physical provider locations. A single virtual directory can contain files physically hosted across multiple separate Google Drive accounts and S3 buckets.

### Database Models

- **`File`**: Represents a virtual file node. Stores logical attributes (`name`, `mimeType`, `sizeBytes`, `folderId`, `userId`, `starred`), content checksum (`sha256`), and provider linkage (`connectedAccountId`, `provider`, `providerFileId`).
- **`Folder`**: Maintains the hierarchical tree structure (`name`, `parentId`, `userId`, `color`, `iconUrl`). Virtual folders do not require corresponding directories on the underlying cloud providers.
- **`ConnectedAccount`**: Represents a storage target (`provider`, `email`, `displayName`, `enabled`, `totalBytes`, `usedBytes`, `revokedAt`). Sensitive access credentials (`refreshToken`, `clientSecret`, `secretAccessKey`) are stored strictly as AES-256-GCM encrypted ciphertext.
- **`FileShare`**: Public and authenticated file sharing records. Stores SHA-256 hashes of share tokens (`tokenHash`) with optional Argon2id password verification.
- **`Invitation`**: Pending workspace invitations (`email`, `role`, `tokenHash`, `invitedById`, `expiresAt`).

---

## 3. Storage Allocation & Routing Engine

When a client initiates an upload:

```text
[Client] ---> POST /uploads/initiate ---> [Storage Router]
                                                  |
           +--------------------------------------+
           | Queries enabled accounts:
           |   SELECT * FROM ConnectedAccount 
           |   WHERE enabled = true AND revokedAt IS NULL
           |
           | Evaluates allocation weights:
           |   freeBytes = totalBytes - usedBytes
           |   candidate = argmax(freeBytes) WHERE freeBytes >= incomingBytes
           v
[Target Account Selected]
           |
           +---> Google Drive: Initiate resumable upload session (Google Drive API v3)
           +---> S3 Bucket: Initiate multipart upload (AWS S3 SDK v3)
```

1. **Quota-Weighted Selection**: Uploads route to the enabled connected account with the largest available free space. If an account is disabled or revoked, it is immediately pruned from the allocation candidate list.
2. **Account Scoping Override**: If a client specifies `?account=<id>` in the request context, the router restricts allocation and queries exclusively to that account.
3. **Bounded Memory Streaming**: The server pipes data between the incoming HTTP socket and the cloud provider using Node.js stream transforms with a high-water mark of 64 KB. File content is never spooled to host disk.
4. **Inline Checksum Calculation**: A cryptographic SHA-256 transform stream computes the digest concurrently with data transfer.
5. **Deduplication Verification**: Before committing metadata to the database, the router checks if an identical file (`sha256`, `name`, `folderId`) already exists in the target scope. If detected, the provider object is pruned and the request terminates with `409 DUPLICATE_CONTENT`.

---

## 4. Role-Based Access Control (RBAC)

BetterDrive implements a strict three-tier role hierarchy: `owner`, `admin`, and `member`.

```text
                      [owner]
                         │
        Can invite admin & member, change roles,
        perform backups, manage cloud credentials
                         │
                         ▼
                      [admin]
                         │
        Can invite members (cannot invite admin),
        disable members, toggle cloud accounts
                         │
                         ▼
                     [member]
        Read/write files, personal API keys,
        profile settings, notification preferences
```

### Permission Matrix

| Operation | Owner | Admin | Member | Enforced Endpoint |
|---|:---:|:---:|:---:|---|
| Browse / Download / Stream Files | Yes | Yes | Yes | `GET /files`, `GET /files/:id/download` |
| Upload / Create Folders / Move / Delete | Yes | Yes | Yes | `POST /uploads`, `POST /folders` |
| Manage Personal Profile & Password | Yes | Yes | Yes | `PATCH /me/profile`, `POST /me/change-password` |
| Create / Revoke Personal API Keys | Yes | Yes | Yes | `GET /me/api-keys`, `POST /me/api-keys` |
| Configure Notification Preferences | Yes | Yes | Yes | `GET/PUT /me/notifications/preferences` |
| Invite Members (`role: member`) | Yes | Yes | No | `POST /system/members/invitations` |
| Invite Admins (`role: admin`) | Yes | No | No | `POST /system/members/invitations` (`INVITATION_ADMIN_REQUIRES_OWNER`) |
| Bulk Change Member Roles | Yes | No | No | `PATCH /system/members/roles/bulk` |
| Disable Members & Revoke Sessions | Yes | Yes | No | `DELETE /system/members/:id`, `POST /system/members/disable/bulk` |
| Add / Reauth / Delete Cloud Accounts | Yes | Yes | No | `POST/DELETE /system/connected-accounts/:id` |
| System Database Backup & Restore | Yes | No | No | `POST /system/backup`, `POST /system/restore` |

---

## 5. SFTP Gateway Subsystem

BetterDrive embeds an SSH2 protocol server on port 2222 that operates as a direct bridge to the virtual filesystem:

- **Key-Only Authentication**: Accepts authorized `ssh-ed25519` and RSA keys (`rsa-sha2-256`, `rsa-sha2-512`). Password, keyboard-interactive, and `none` methods are rejected at the protocol negotiation layer.
- **Path Jailing**: Sessions are scoped to an authorized directory root (`allowedRoots`). Path resolution resolves relative traversals (`../`) against the root. Requests attempting to escape the sandbox return `SSH_FX_PERMISSION_DENIED`.
- **Channel Restriction**: Shell execution, exec commands, PTY allocation, and port forwarding are rejected. Only the `sftp` subsystem channel is initialized.
- **Streaming VFS Operations**: SFTP read and write operations translate into bounded stream chunks, allowing gigabyte-scale transfers while maintaining memory consumption below 200 MB RSS delta.
- **Audit Logging**: Every connection event, authentication decision, file interaction, and disconnection is recorded in `SftpSessionLog` with timestamp, client IP, key fingerprint, and outcome status.

---

## 6. Account Lifecycle & Revocation

- **Active State (`enabled: true`)**: Account accepts read/write operations and participates in dynamic storage allocation.
- **Disabled State (`enabled: false`)**: Account is excluded from the allocation pool and header switcher. Existing files remain accessible in read-only mode.
- **Revoked State (`revokedAt != null`)**: Account credentials have been disconnected or invalidated. Existing file metadata remains preserved to protect data integrity, but file mutations return `FILE_ACCOUNT_REVOKED` (403).
