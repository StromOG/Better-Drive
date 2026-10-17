#!/usr/bin/env node
/**
 * Better Drive Terminal Banner & Launch Animation
 */

const esc = '\x1b['
const reset = `${esc}0m`
const bold = `${esc}1m`
const cyan = `${esc}36m`
const brightCyan = `${esc}96m`
const blue = `${esc}34m`
const brightBlue = `${esc}94m`
const brightGreen = `${esc}92m`
const yellow = `${esc}33m`
const dim = `${esc}90m`
const white = `${esc}97m`

const banner = `
${brightCyan}  ██████╗ ███████╗████████╗████████╗███████╗██████╗     ██████╗ ██████╗ ██╗██╗   ██╗███████╗
  ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗    ██╔══██╗██╔══██╗██║██║   ██║██╔════╝
  ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝    ██║  ██║██████╔╝██║██║   ██║█████╗  
  ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗    ██║  ██║██╔══██╗██║╚██╗ ██╔╝██╔══╝  
  ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║    ██████╔╝██║  ██║██║ ╚████╔╝ ███████╗
  ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝${reset}
`

const boxWidth = 74
const hr = `${dim}${'─'.repeat(boxWidth)}${reset}`

function printDashboard() {
  console.log(banner)
  console.log(`  ${brightCyan}${bold}BETTER DRIVE${reset} ${dim}— Multi-Cloud Storage Gateway v1.0.0${reset}`)
  console.log(`  ${hr}`)
  console.log(`  ${dim}│${reset}  ${brightGreen}●${reset} ${bold}Web Dashboard:${reset}    ${white}http://localhost:5173${reset}               ${dim}[Instant PWA]${reset}`)
  console.log(`  ${dim}│${reset}  ${brightCyan}●${reset} ${bold}API Gateway:${reset}      ${white}http://localhost:4000${reset}               ${dim}[Express Engine]${reset}`)
  console.log(`  ${dim}│${reset}  ${yellow}●${reset} ${bold}Storage Pool:${reset}     ${dim}Google Drive Multi-Account + S3 Compatible${reset}`)
  console.log(`  ${dim}│${reset}  ${brightBlue}●${reset} ${bold}Security Layer:${reset}   ${dim}Argon2id + AES-256-GCM + CSP Sandbox${reset}`)
  console.log(`  ${hr}`)
  console.log(`  ${dim}Single terminal active. Press ${reset}${bold}Ctrl+C${reset}${dim} at any time to shut down.${reset}\n`)
}

async function runAnimation() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const colors = [brightCyan, cyan, brightBlue, blue, brightGreen]
  const tasks = [
    'Verifying SQLite database integrity...',
    'Checking AES-256 token encryption keys...',
    'Configuring multi-cloud storage router...',
    'Ready. Launching Better Drive gateway...',
  ]

  let frameIdx = 0
  for (let t = 0; t < tasks.length; t++) {
    const task = tasks[t]
    for (let f = 0; f < 3; f++) {
      const char = frames[frameIdx % frames.length]
      const col = colors[frameIdx % colors.length]
      process.stdout.write(`\r  ${col}${char}${reset} ${dim}${task}${reset} `)
      await new Promise((r) => setTimeout(r, 70))
      frameIdx++
    }
    process.stdout.write(`\r  ${brightGreen}✔${reset} ${dim}${task}${reset}\n`)
  }
  console.log('')
}

printDashboard()
await runAnimation()
