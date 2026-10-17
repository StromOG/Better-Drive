@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   BetterDrive v1.0.0 Setup Wizard      
echo ========================================

:: 1. Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js v20 or later from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Install dependencies
echo.
echo [*] Installing dependencies across workspaces...
call npm install --prefer-offline --no-audit --no-fund
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

:: 3. Ensure environment & initialize SQLite database
echo.
echo [*] Deploying database migrations...
call npm run setup
if errorlevel 1 (
    echo [ERROR] Database setup failed.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] BetterDrive setup complete!
echo Run start.bat or npm run dev to launch.
