# Command Line & Headless Administration Guide

BetterDrive can be deployed, configured, and administered entirely from the command line on headless servers, containers, and automated infrastructure.

---

## 1. Environment Configuration

All core server settings can be passed through environment variables in `backend/.env` or container runtime environments:

```env
# Application
NODE_ENV=production
PORT=4000
APP_URL=http://localhost:5173
DATABASE_URL="file:./dev.db"

# Security Secrets (Must be 32+ characters / 32-byte hex)
JWT_ACCESS_SECRET="generate-a-strong-random-jwt-access-secret-minimum-32-chars"
TOKEN_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Embedded SFTP Gateway
SFTP_ENABLED="true"
SFTP_PORT=2222

# Reverse Proxy Trust
TRUST_PROXY="true"
```

To generate a secure 32-byte hex encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Headless Setup & Database Migrations

### Windows (PowerShell)
```powershell
npm install
node scripts/ensure-env.mjs
npm run db:deploy
node scripts/seed-demo.mjs   # Optional: seeds demo user and accounts
npm run dev
```

### Linux / macOS (Bash)
```bash
npm install
node scripts/ensure-env.mjs
npm run db:deploy
node scripts/seed-demo.mjs   # Optional: seeds demo user and accounts
npm run dev
```

---

## 3. Direct REST API Administration (cURL)

Administrative actions can be executed via authenticated HTTP requests.

### Authenticate & Obtain Bearer Token:
```bash
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@betterdrive.local","password":"DemoPassword2026!"}'
```

### Connect an S3 Bucket:
```bash
curl -X POST http://localhost:4000/system/connected-accounts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "s3",
    "label": "Production Vault",
    "bucket": "betterdrive-vault",
    "region": "us-east-1",
    "endpoint": "https://s3.us-east-1.amazonaws.com",
    "accessKeyId": "AKIAXXXXXXXXXXXXXXXX",
    "secretAccessKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forcePathStyle": false
  }'
```

### Generate a Team Member Invitation:
```bash
curl -X POST http://localhost:4000/system/members/invitations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@company.com","role":"member"}'
```

### Provision a Programmatic API Key:
```bash
curl -X POST http://localhost:4000/me/api-keys \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"label":"CI Deployment Key"}'
```

---

## 4. SFTP Command-Line Access

Once an SSH public key is enrolled under `/termius` or `/settings/sftp`, connect directly via OpenSSH:

```bash
# Connect using specific private key on port 2222
sftp -P 2222 -i ~/.ssh/id_ed25519 demo@localhost

# Upload a directory of release assets
sftp -P 2222 -i ~/.ssh/id_ed25519 demo@localhost <<< $'put -r ./dist /ReleaseArchives'
```

---

## 5. Windows PowerShell CLI Automation

For automated Windows Server backups or CI runners without external tooling:

### Streaming File Upload:
```powershell
$headers = @{ "Authorization" = "Bearer bd_live_your_api_key_here" }
$filePath = "C:\backups\database_snapshot.zip"
$form = @{
  file = Get-Item -Path $filePath
  folderId = "" # Optional virtual folder UUID
}
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/uploads" -Method Post -Headers $headers -Form $form
Write-Host "Uploaded $($response.file.name) (SHA-256: $($response.file.checksum))" -ForegroundColor Green
```

### Querying Pooled Quota & Health:
```powershell
$headers = @{ "Authorization" = "Bearer bd_live_your_api_key_here" }
$quota = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/storage/quota" -Headers $headers
$accounts = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/connected-accounts" -Headers $headers

Write-Host "Total Quota: $([math]::Round($quota.totalBytes / 1GB, 2)) GB | Used: $([math]::Round($quota.usedBytes / 1GB, 2)) GB"
Write-Host "Connected Providers: $($accounts.accounts.Count)"
```

---

## 6. AWS S3 CLI Direct Operations

Inspect and mirror objects directly with standard AWS CLI v2:

### Test S3 Endpoint & List Objects:
```bash
aws s3 ls s3://betterdrive-vault/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

### Mirror Local Directory to S3 Cloud Bucket:
```bash
aws s3 sync /local/data s3://betterdrive-vault/data/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --delete
```

### Generate 1-Hour Presigned Download URL:
```bash
aws s3 presign s3://betterdrive-vault/document.pdf \
  --expires-in 3600 \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

---

## 7. Rclone Sync & Virtual Drive Mount

Mount BetterDrive as a native Windows drive letter (`Z:`) or POSIX filesystem:

### 1. Configure SFTP Remote (`~/.config/rclone/rclone.conf`):
```ini
[betterdrive]
type = sftp
host = 127.0.0.1
port = 2222
user = admin
key_file = ~/.ssh/id_ed25519
shell_type = unix
```

### 2. Mount as Native Virtual Drive:
```bash
# Windows Explorer (Creates virtual drive Z:)
rclone mount betterdrive: Z: --vfs-cache-mode writes --dir-cache-time 1m

# Linux / macOS (Requires FUSE)
rclone mount betterdrive: /mnt/betterdrive --vfs-cache-mode full --daemon
```

### 3. High-Speed Bandwidth-Throttled Sync:
```bash
rclone sync /local/nas/storage betterdrive:nas_backup \
  --transfers 8 \
  --bwlimit 20M \
  --fast-list \
  --progress
```

