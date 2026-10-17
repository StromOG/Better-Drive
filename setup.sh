#!/usr/bin/env bash
# BetterDrive Setup (Linux / macOS)
# Installs dependencies, sets up environment variables, and applies database migrations.

set -e
cd "$(dirname "$0")"

echo "========================================"
echo "  BetterDrive v1.0.0 Setup Wizard      "
echo "========================================"

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "Please install Node.js (version 20 or later) from https://nodejs.org/"
    exit 1
fi

# 2. Install dependencies
echo ""
echo "[*] Installing dependencies across workspaces..."
npm install --prefer-offline --no-audit --no-fund

# 3. Ensure environment & initialize SQLite database
echo ""
echo "[*] Deploying database migrations..."
npm run setup

echo ""
echo "[SUCCESS] BetterDrive setup complete!"
echo "Run ./start.sh or npm run dev to launch."
