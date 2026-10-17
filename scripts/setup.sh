#!/usr/bin/env bash
set -e

# Set working directory to repository root
cd "$(dirname "$0")/.."

echo "=========================================================================="
echo "  BETTER DRIVE - AUTOMATED INSTALLATION & SETUP"
echo "=========================================================================="
echo ""

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not found in your PATH."
    echo "Please install Node.js v20 or later from https://nodejs.org/"
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[ERROR] Detected Node.js v${NODE_MAJOR}, but Better Drive requires Node.js v20 or newer."
    echo "Please update Node.js from https://nodejs.org/"
    exit 1
fi
echo "[*] Node.js environment verified: v${NODE_MAJOR} detected."

# 2. Check for npm
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm was not found. Please ensure npm is installed alongside Node.js."
    exit 1
fi
echo "[*] npm package manager verified."

# 3. Install root and workspace dependencies
echo ""
echo "[*] Step 1/4: Installing workspace dependencies..."
npm install --no-audit --no-fund
echo "[OK] Dependencies installed."

# 4. Ensure environment and cryptographic keys
echo ""
echo "[*] Step 2/4: Generating environment files and cryptographic secrets..."
node scripts/ensure-env.mjs
echo "[OK] Environment configured (.env files and keys created)."

# 5. Create local storage and host key directories
mkdir -p backend/data data

# 6. Deploy database migrations and generate Prisma clients
echo ""
echo "[*] Step 3/4: Deploying database migrations and generating Prisma client..."
npm run db:deploy
npm run db:generate
echo "[OK] Database schema initialized and Prisma client generated."

# 7. Check schema parity
echo ""
echo "[*] Step 4/4: Validating multi-database schema parity..."
npm run schema:check
echo "[OK] Schema parity validated across SQLite, PostgreSQL, and MySQL."

echo ""
echo "=========================================================================="
echo "  [SUCCESS] BETTER DRIVE IS FULLY SETUP AND READY TO RUN!"
echo "=========================================================================="
echo ""
echo "  Web Dashboard: http://localhost:5173"
echo "  API Gateway:   http://localhost:4000"
echo ""
echo "  You can launch Better Drive anytime by running: ./start.sh"
echo ""

read -r -p "Would you like to start Better Drive right now? (y/N): " LAUNCH
if [ "$LAUNCH" = "y" ] || [ "$LAUNCH" = "Y" ]; then
    echo ""
    echo "[*] Launching Better Drive..."
    exec ./start.sh
else
    echo "Setup complete. Run ./start.sh when you are ready."
fi
