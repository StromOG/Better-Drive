#!/usr/bin/env bash
# BetterDrive v1.0.0 — Unified Multi-Cloud Storage Gateway
set -e

# Set working directory to the directory containing this script
cd "$(dirname "$0")"

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "Please install Node.js (version 20 or later) from: https://nodejs.org/"
    exit 1
fi

# 2. Check dependencies (fast install with offline cache preference)
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies across workspaces..."
    npm install --prefer-offline --no-audit --no-fund
fi

# 3. Setup check: ensure environment, data directories, and database migrations
if [ "$1" = "--setup" ]; then
    exec ./setup.sh
elif [ "$1" = "--update" ]; then
    echo "[*] Updating database schema..."
    npm run setup
else
    node scripts/ensure-env.mjs
    if [ ! -f "backend/dev.db" ]; then
        echo "[*] Initializing SQLite database..."
        npm run db:deploy
    fi
fi

# 4. Render terminal dashboard and launch animation in this single terminal
node scripts/banner.mjs

# 5. Start servers (Vite handles browser opening natively)
exec npm run dev
