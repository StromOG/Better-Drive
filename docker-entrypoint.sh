#!/bin/sh
set -e

# Ensure SQLite storage directory exists
mkdir -p /app/data

# Deploy database migrations automatically on boot
echo "[*] BetterDrive: Deploying database migrations..."
cd /app/backend
node scripts/prisma.mjs migrate deploy 2>/dev/null || npx prisma migrate deploy --schema=prisma/schema.prisma

# Launch production server
echo "[*] BetterDrive: Starting unified storage gateway on port ${PORT:-4000} (SFTP: ${SFTP_PORT:-2222})..."
cd /app
exec node backend/dist/server.js
