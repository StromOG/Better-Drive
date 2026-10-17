# Production Deployment Guide

This guide covers deploying BetterDrive in production using Docker Compose or bare-metal Linux nodes with systemd and reverse proxies.

---

## 1. Architecture Requirements

- **Node.js**: `20.x` or later
- **Memory**: Minimum 512 MB RAM (1 GB recommended for high concurrent SFTP streams)
- **Database Options**:
  - **SQLite (Default)**: Embedded, zero-maintenance, runs in WAL mode with robust concurrent reads. Recommended for single-node deployments.
  - **PostgreSQL (`>= 14`)**: Recommended for clustered high-availability setups.
  - **MySQL (`>= 8.0`)**: Supported with full schema parity.

---

## 2. Docker Compose Deployment (Recommended)

BetterDrive includes a multi-stage `Dockerfile` and `docker-compose.yml` for self-contained deployments.

### `docker-compose.yml`

```yaml
services:
  betterdrive:
    image: betterdrive:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "4000:4000"     # Web dashboard & REST API
      - "2222:2222"     # Embedded SFTP Gateway
    environment:
      - NODE_ENV=production
      - PORT=4000
      - APP_URL=https://drive.example.com
      - DATABASE_URL=file:/app/data/betterdrive.db
      - JWT_ACCESS_SECRET=replace-with-secure-jwt-secret-min-32-chars
      - TOKEN_ENCRYPTION_KEY=replace-with-32-byte-hex-encryption-key
      - SFTP_ENABLED=true
      - SFTP_PORT=2222
      - TRUST_PROXY=true
    volumes:
      - betterdrive_data:/app/data

volumes:
  betterdrive_data:
    driver: local
```

### Launch Service:
```bash
docker compose up -d --build
```

---

## 3. Bare-Metal Systemd Service

### Step 1: Build Application
```bash
git clone https://github.com/zenhosta/better-drive.git /opt/betterdrive
cd /opt/betterdrive
npm ci
npm run build
```

### Step 2: Systemd Unit File
Create `/etc/systemd/system/betterdrive.service`:

```ini
[Unit]
Description=BetterDrive Multi-Cloud Storage Gateway
After=network.target

[Service]
Type=simple
User=betterdrive
Group=betterdrive
WorkingDirectory=/opt/betterdrive
EnvironmentFile=/opt/betterdrive/backend/.env
ExecStart=/usr/bin/node backend/dist/server.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### Step 3: Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now betterdrive
```

---

## 4. Reverse Proxy Configurations

### Caddy (`/etc/caddy/Caddyfile`)
Caddy handles automatic HTTPS and WebSocket proxying with minimal configuration:

```caddy
drive.example.com {
    reverse_proxy localhost:4000 {
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
```

### Nginx (`/etc/nginx/sites-available/betterdrive`)

```nginx
server {
    listen 80;
    server_name drive.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name drive.example.com;

    ssl_certificate /etc/letsencrypt/live/drive.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/drive.example.com/privkey.pem;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Optional: SFTP Stream Proxy (Requires Nginx stream module)
stream {
    server {
        listen 2222;
        proxy_pass 127.0.0.1:2222;
    }
}
```

---

## 5. Database Backup & Disaster Recovery

### SQLite Backup (Zero Downtime)
SQLite WAL mode allows online backups while the server actively handles traffic:
```bash
sqlite3 /app/data/betterdrive.db ".backup '/backup/betterdrive-$(date +%F).db'"
```

### Automated In-App Snapshot
An authenticated `owner` can download an encrypted full snapshot archive via:
```bash
curl -X POST https://drive.example.com/system/backup \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -o backup.zip
```
