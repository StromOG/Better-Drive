# BetterDrive Setup (PowerShell)
# Installs dependencies, sets up environment variables, and applies database migrations.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BetterDrive v1.0.0 Setup Wizard      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (version 20 or later) from https://nodejs.org/"
    Exit 1
}

# 2. Install dependencies
Write-Host "`n[*] Installing dependencies across workspaces..." -ForegroundColor Yellow
npm install --prefer-offline --no-audit --no-fund

# 3. Ensure environment & initialize SQLite database
Write-Host "`n[*] Deploying database migrations..." -ForegroundColor Yellow
npm run setup

Write-Host "`n[SUCCESS] BetterDrive setup complete!" -ForegroundColor Green
Write-Host "Run .\start.bat or npm run dev to launch." -ForegroundColor Green
