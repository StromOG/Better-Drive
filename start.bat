@echo off
setlocal

:: Set working directory to the directory containing this script
cd /d "%~dp0"

title BetterDrive v1.0.0 — Storage Gateway

:: 1. Check for Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js v20 or later from https://nodejs.org/
    echo Opening download page...
    start https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check dependencies - fast install with offline cache preference
if not exist "node_modules\" (
    echo [*] Installing dependencies across workspaces...
    call npm install --prefer-offline --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] npm install failed. Please check your network connection.
        echo.
        pause
        exit /b 1
    )
)

:: 3. Setup check: ensure environment, data directories, and database migrations
if "%~1"=="--setup" (
    call "%~dp0scripts\setup.bat"
    exit /b 0
) else if "%~1"=="--update" (
    echo [*] Updating database schema...
    call npm run setup
) else (
    call node scripts/ensure-env.mjs
    if not exist "backend\dev.db" (
        echo [*] Initializing SQLite database...
        call npm run db:deploy
    )
)

if errorlevel 1 (
    echo [ERROR] Setup failed.
    echo.
    pause
    exit /b 1
)

:: 4. Start Better Drive dev orchestrator in this single terminal
node --no-deprecation scripts/dev.mjs

if errorlevel 1 (
    echo.
    echo [ERROR] Application exited with an error.
    pause
    exit /b 1
)

:: Auto-close terminal window on clean exit
exit
