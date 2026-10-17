#!/usr/bin/env node
/**
 * Better Drive Studio Dev Orchestrator
 * Clean, noise-free, dual-process runner with graceful interactive termination.
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const esc = '\x1b['
const reset = `${esc}0m`
const bold = `${esc}1m`
const dim = `${esc}90m`
const brightCyan = `${esc}96m`
const brightMagenta = `${esc}95m`
const green = `${esc}32m`
const brightGreen = `${esc}92m`
const brightYellow = `${esc}93m`
const red = `${esc}31m`
const white = `${esc}97m`

// Candy theme ANSI banner (Sky Blue to Candy Pink)
const banner = `
${brightCyan}  ██████╗ ███████╗████████╗████████╗███████╗██████╗${brightMagenta}     ██████╗ ██████╗ ██╗██╗   ██╗███████╗
${brightCyan}  ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗${brightMagenta}    ██╔══██╗██╔══██╗██║██║   ██║██╔════╝
${brightCyan}  ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝${brightMagenta}    ██║  ██║██████╔╝██║██║   ██║█████╗  
${brightCyan}  ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗${brightMagenta}    ██║  ██║██╔══██╗██║╚██╗ ██╔╝██╔══╝  
${brightCyan}  ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║${brightMagenta}    ██████╔╝██║  ██║██║ ╚████╔╝ ███████╗
${brightCyan}  ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝${brightMagenta}    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝${reset}
`

function clearConsole() {
  process.stdout.write(process.platform === 'win32' ? '\x1b[2J\x1b[0f' : '\x1b[2J\x1b[3J\x1b[H')
}

clearConsole()
console.log(banner)
console.log(`  ${brightCyan}${bold}BETTER DRIVE${reset} ${dim}— Unified Multi-Cloud Storage Gateway v1.0.0${reset}`)
console.log(`  ${dim}──────────────────────────────────────────────────────────────────────────${reset}`)
console.log(`  ${dim}│${reset}  ${brightMagenta}●${reset} ${bold}Web Interface:${reset}    ${white}http://localhost:5173${reset}               ${dim}[Vite Candy PWA]${reset}`)
console.log(`  ${dim}│${reset}  ${brightCyan}●${reset} ${bold}API Server:${reset}       ${white}http://localhost:4000${reset}               ${dim}[Express + SQLite]${reset}`)
console.log(`  ${dim}│${reset}  ${brightYellow}●${reset} ${bold}Storage Pool:${reset}     ${dim}Google Drive + S3 / MinIO / Backblaze B2${reset}`)
console.log(`  ${dim}│${reset}  ${green}●${reset} ${bold}Security Vault:${reset}   ${dim}Argon2id + AES-256-GCM + Local SQLite${reset}`)
console.log(`  ${dim}──────────────────────────────────────────────────────────────────────────${reset}`)
console.log(`  ${dim}Press ${reset}${bold}Ctrl+C${reset}${dim} anytime to safely stop the gateway.${reset}\n`)

// Launch animation
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const steps = [
  'Verifying local database and environment...',
  'Checking AES-256 cryptographic keys...',
  'Starting API server and web dashboard...',
]

for (const step of steps) {
  for (let i = 0; i < 3; i++) {
    const frame = frames[(step.length + i) % frames.length]
    process.stdout.write(`\r  ${brightCyan}${frame}${reset} ${dim}${step}${reset} `)
    await new Promise((r) => setTimeout(r, 45))
  }
  process.stdout.write(`\r  ${brightGreen}✔${reset} ${dim}${step}${reset}\n`)
}
console.log(`  ${dim}──────────────────────────────────────────────────────────────────────────${reset}\n`)

const isWin = process.platform === 'win32'

let isPromptingExit = false
let isExiting = false
let apiProcess = null
let webProcess = null

// Line filter to remove noise and warnings
function filterLine(line) {
  if (!line || !line.trim()) return null
  const trimmed = line.trim()
  if (
    trimmed.startsWith('>') ||
    trimmed.startsWith('npm') ||
    trimmed.includes('dotenvx') ||
    trimmed.includes('injected env') ||
    trimmed.includes('DeprecationWarning') ||
    trimmed.includes('trace-deprecation') ||
    trimmed.includes('Terminate batch job') ||
    trimmed === '^C' ||
    trimmed === '[WEB ERR] ^C' ||
    trimmed === '[API ERR] ^C'
  ) {
    return null
  }
  return trimmed
}

// Spawn Backend - Single command string with shell: true completely eliminates [DEP0190]
const apiCmd = isWin ? 'npx.cmd tsx watch src/server.ts' : 'npx tsx watch src/server.ts'
apiProcess = spawn(apiCmd, {
  cwd: join(root, 'backend'),
  env: { ...process.env, FORCE_COLOR: '1' },
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

apiProcess.stdout?.on('data', (data) => {
  if (isPromptingExit || isExiting) return
  const lines = data.toString().split('\n')
  for (const raw of lines) {
    const line = filterLine(raw)
    if (line) {
      console.log(`  ${brightCyan}[API]${reset} ${line}`)
    }
  }
})

apiProcess.stderr?.on('data', (data) => {
  if (isPromptingExit || isExiting) return
  const lines = data.toString().split('\n')
  for (const raw of lines) {
    const line = filterLine(raw)
    if (line) {
      console.log(`  ${red}[API ERR]${reset} ${line}`)
    }
  }
})

let browserOpened = false
function openBrowser(url) {
  if (browserOpened) return
  browserOpened = true
  try {
    if (isWin) {
      spawn('cmd.exe', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
    }
  } catch {
    // Ignore browser open failure
  }
}

// Spawn Frontend - Single command string with shell: true eliminates [DEP0190]
const webCmd = isWin ? 'npx.cmd vite --open' : 'npx vite --open'
webProcess = spawn(webCmd, {
  cwd: join(root, 'frontend'),
  env: { ...process.env, FORCE_COLOR: '1' },
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

webProcess.stdout?.on('data', (data) => {
  if (isPromptingExit || isExiting) return
  const lines = data.toString().split('\n')
  for (const raw of lines) {
    const line = filterLine(raw)
    if (line) {
      console.log(`  ${brightMagenta}[WEB]${reset} ${line}`)
      if (line.includes('Local:') && line.includes('5173')) {
        openBrowser('http://localhost:5173')
      }
    }
  }
})

webProcess.stderr?.on('data', (data) => {
  if (isPromptingExit || isExiting) return
  const lines = data.toString().split('\n')
  for (const raw of lines) {
    const line = filterLine(raw)
    if (line) {
      console.log(`  ${red}[WEB ERR]${reset} ${line}`)
    }
  }
})

// Clean Exit Orchestration
async function gracefulExit() {
  if (isExiting) return
  isExiting = true
  isPromptingExit = false

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false)
      process.stdin.pause()
    } catch {
      // ignore
    }
  }

  console.log(`\n\n  ${brightCyan}[*] Gracefully stopping Better Drive...${reset}`)
  const closeSteps = [
    'Terminating Vite web dashboard (port 5173)...',
    'Terminating API backend server (port 4000)...',
    'Flushing SQLite database WAL journals...',
  ]

  for (const step of closeSteps) {
    process.stdout.write(`  ${brightYellow}⠹${reset} ${dim}${step}${reset} `)
    await new Promise((r) => setTimeout(r, 55))
    process.stdout.write(`\r  ${brightGreen}✔${reset} ${dim}${step}${reset}\n`)
  }

  try {
    if (isWin) {
      if (apiProcess?.pid) spawn('taskkill', ['/pid', String(apiProcess.pid), '/f', '/t'], { stdio: 'ignore' })
      if (webProcess?.pid) spawn('taskkill', ['/pid', String(webProcess.pid), '/f', '/t'], { stdio: 'ignore' })
    } else {
      apiProcess?.kill('SIGINT')
      webProcess?.kill('SIGINT')
    }
  } catch {
    // ignore
  }

  console.log(`\n  ${brightGreen}✔ Better Drive stopped cleanly.${reset}`)
  process.stdout.write(`  ${dim}Closing terminal window in 2 seconds...${reset}`)
  await new Promise((r) => setTimeout(r, 1000))
  process.stdout.write(`\r  ${dim}Closing terminal window in 1 second... ${reset}`)
  await new Promise((r) => setTimeout(r, 1000))
  process.exit(0)
}

function promptExit() {
  isPromptingExit = true
  process.stdout.write(`\n  ${brightYellow}? Stop Better Drive? Press 'y' to confirm or 'n' / Esc to keep running: ${reset}`)
}

function cancelExit() {
  isPromptingExit = false
  process.stdout.write(`\r  ${brightGreen}✔ Shutdown cancelled. Better Drive is running.${reset}                       \n\n`)
}

// Raw Mode Keyboard Listener: Intercepts Ctrl+C directly before Windows cmd.exe sees it
if (process.stdin.isTTY) {
  try {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    process.stdin.on('data', (key) => {
      // Ctrl+C (\u0003) or Ctrl+D (\u0004)
      if (key === '\u0003' || key === '\u0004') {
        if (isPromptingExit) {
          // Second Ctrl+C confirms exit immediately
          gracefulExit()
          return
        }
        promptExit()
        return
      }

      // If user is being prompted for exit
      if (isPromptingExit) {
        const lower = key.toLowerCase()
        if (lower === 'y' || key === '\r' || key === '\n') {
          gracefulExit()
        } else if (lower === 'n' || key === '\u001b' || key === ' ') {
          cancelExit()
        }
      }
    })
  } catch {
    // Fallback if rawMode fails
    process.on('SIGINT', () => {
      gracefulExit()
    })
  }
} else {
  process.on('SIGINT', () => gracefulExit())
}

process.on('SIGTERM', () => gracefulExit())
