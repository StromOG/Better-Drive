@echo off
setlocal EnableDelayedExpansion

:: Set working directory to the repository root
cd /d "%~dp0.."

title Better Drive - System Setup

echo ==========================================================================
echo   BETTER DRIVE - AUTOMATED INSTALLATION ^& SETUP
echo ==========================================================================
echo.

:: 1. Check for Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js v20 or later from https://nodejs.org/
    echo Opening download page...
    start https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%v in ('node -v') do set NODE_VERSION_RAW=%%v
for /f "tokens=1 delims=." %%m in ("%NODE_VERSION_RAW:~1%") do set NODE_MAJOR=%%m

if %NODE_MAJOR% LSS 20 (
    echo [ERROR] Detected Node.js v%NODE_MAJOR%, but Better Drive requires Node.js v20 or newer.
    echo Please update Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [*] Node.js environment verified: v!NODE_MAJOR! detected.

:: 2. Check for npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Please ensure npm is installed alongside Node.js.
    echo.
    pause
    exit /b 1
)
echo [*] npm package manager verified.

:: 3. Install root and workspace dependencies
echo.
echo [*] Step 1/4: Installing workspace dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies. Please check your network connection.
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: 4. Ensure environment and cryptographic keys
echo.
echo [*] Step 2/4: Generating environment files and cryptographic secrets...
call node scripts/ensure-env.mjs
if errorlevel 1 (
    echo [ERROR] Environment initialization failed.
    echo.
    pause
    exit /b 1
)
echo [OK] Environment configured (.env files and keys created).

:: 5. Create local storage and host key directories
if not exist "backend\data" mkdir "backend\data"
if not exist "data" mkdir "data"

:: 6. Deploy database migrations and generate Prisma clients
echo.
echo [*] Step 3/4: Deploying database migrations and generating Prisma client...
call npm run db:deploy
if errorlevel 1 (
    echo [ERROR] Database migration deployment failed.
    echo.
    pause
    exit /b 1
)

call npm run db:generate
if errorlevel 1 (
    echo [ERROR] Prisma client generation failed.
    echo.
    pause
    exit /b 1
)
echo [OK] Database schema initialized and Prisma client generated.

:: 7. Check schema parity
echo.
echo [*] Step 4/4: Validating multi-database schema parity...
call npm run schema:check
if errorlevel 1 (
    echo [ERROR] Schema sync check failed.
    echo.
    pause
    exit /b 1
)
echo [OK] Schema parity validated across SQLite, PostgreSQL, and MySQL.

echo.
echo ==========================================================================
echo   [SUCCESS] BETTER DRIVE IS FULLY SETUP AND READY TO RUN!
echo ==========================================================================
echo.
echo   Web Dashboard: http://localhost:5173
echo   API Gateway:   http://localhost:4000
echo.
echo   You can launch Better Drive anytime by running: start.bat
echo.

set /p LAUNCH="Would you like to start Better Drive right now? (Y/N): "
if /i "!LAUNCH!"=="Y" (
    echo.
    echo [*] Launching Better Drive...
    call "%~dp0start.bat"
) else (
    echo.
    echo Setup complete. Run start.bat when you are ready.
    pause
)
