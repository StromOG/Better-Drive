import type { MascotMood } from './ByteMascot'

export interface PlaceGuideStep {
  text: string
  badge: string
  mood: MascotMood
  action?: {
    label: string
    actionKey?: string
  }
}

/**
 * In-depth step-by-step place guides triggered when user clicks the Guide button (Compass)
 * or asks Byte for contextual assistance on a specific screen.
 */
export const PLACE_GUIDE_DIALOGUES: Record<string, PlaceGuideStep[]> = {
  'all-files': [
    {
      badge: 'VAULT GUIDE · 1/5',
      mood: 'guide',
      text: '📁 Unified Virtual File System: Files from all connected Google Drive accounts and S3 buckets are indexed in one clean hierarchy. Drag and drop any file directly onto a folder row to move it instantly!',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'VAULT GUIDE · 2/5',
      mood: 'guide',
      text: '⚡ Zero-Copy Deduplication: Drag files anywhere on screen to upload. Better Drive computes off-thread SHA-256 hashes in a Web Worker — identical files finish in 20ms without wasting cloud bandwidth!',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'VAULT GUIDE · 3/5',
      mood: 'guide',
      text: '📦 Batch ZIP Streaming: Need to download a batch of assets? Select items using the checkboxes, then click the top ZIP icon to stream a single unified archive directly to your browser.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'VAULT GUIDE · 4/5',
      mood: 'guide',
      text: '🔍 Sandboxed Preview: Click any file to preview! Images and video play with zero-latency streaming, and text/code files render in our hardened plaintext sandbox with 100% DOM XSS immunity.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'VAULT GUIDE · 5/5',
      mood: 'celebrate',
      text: '⌨️ Power Hotkeys: Press "/" or Ctrl+K to jump to search, "j" / "k" to navigate files, "x" to select, and "?" anytime to view the complete keyboard shortcuts cheat sheet!',
      action: { label: 'Show Shortcuts', actionKey: 'open_shortcuts' },
    },
  ],
  termius: [
    {
      badge: 'SFTP GUIDE · 1/4',
      mood: 'guide',
      text: '🖥️ Termius SFTP Gateway: You can mount your entire multi-cloud storage pool inside Termius (iOS, Android, macOS, Linux, Windows) or any SFTP client via port 2222!',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SFTP GUIDE · 2/4',
      mood: 'guide',
      text: '🔑 Zero-Trust Key Authentication: Password logins are blocked by default. Generate an Ed25519 or RSA key pair in Termius, paste your public key in Authorized Keys below, and you are ready.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SFTP GUIDE · 3/4',
      mood: 'guide',
      text: '🛡️ Granular Access Profiles: Restrict individual SSH keys to specific folders, enforce read-only safety, or set maximum bandwidth ceilings per device.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SFTP GUIDE · 4/4',
      mood: 'celebrate',
      text: '⚡ Low-Memory Streaming: Better Drive streams files directly over the wire to your storage providers. Transfers consume under 70MB RAM even for huge 100MB+ files with zero disk temp bloat.',
      action: { label: 'View Audit Logs', actionKey: 'open_activity' },
    },
  ],
  quota: [
    {
      badge: 'QUOTA GUIDE · 1/4',
      mood: 'guide',
      text: '📊 Pooled Cloud Vault: Better Drive combines all your connected Google Drive accounts and S3 buckets into one unified capacity bar. You never run out of room on a single account!',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'QUOTA GUIDE · 2/4',
      mood: 'guide',
      text: '⚖️ Intelligent Space Routing: Uploads automatically route to the cloud provider with the highest available free space, balancing your multi-cloud tiers without manual juggling.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'QUOTA GUIDE · 3/4',
      mood: 'guide',
      text: '🧹 Duplicate Cleaner Rails: Check the Duplicate Cleaner section below. You can run dry-runs to inspect wasted space and move identical files to Trash with zero risk of permanent loss.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'QUOTA GUIDE · 4/4',
      mood: 'celebrate',
      text: '💡 Quota Health Alerts: If any provider reaches 90% capacity, Better Drive warns you immediately so you can attach another free bucket or run a quick cleanup.',
      action: { label: 'Connect Storage', actionKey: 'connect_storage' },
    },
  ],
  settings: [
    {
      badge: 'SETTINGS GUIDE · 1/4',
      mood: 'guide',
      text: '☁️ Multi-Cloud Providers: Connect unlimited Google Drive accounts or S3-compatible buckets (AWS, Cloudflare R2, MinIO, Backblaze B2, Wasabi) in the Storage tab.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SETTINGS GUIDE · 2/4',
      mood: 'guide',
      text: '💾 Database Backup & 1-Click Restore: Download full SQLite snapshots or JSON migration packages to keep your vault backups completely safe, portable, and restorable with auto-rollback.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SETTINGS GUIDE · 3/4',
      mood: 'guide',
      text: '🎨 Themes & Mascot Outfits: Choose from 12 curated dark/light palettes in Appearance, and dress me up with Detective hats, Sunglasses, or Wand accessories in the Mascot tab!',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SETTINGS GUIDE · 4/4',
      mood: 'celebrate',
      text: '🔐 Zero-Trust Security: Inspect OAuth redirect URIs, audit active sessions, and review hardened proxy headers to ensure your self-hosted setup stays bulletproof.',
      action: { label: 'All Files', actionKey: 'open_all_files' },
    },
  ],
  activity: [
    {
      badge: 'AUDIT GUIDE · 1/3',
      mood: 'guide',
      text: '📜 Tamper-Evident Audit Trail: Every file upload, deletion, login, and Termius SFTP connection is recorded with client IP, timestamp, and SHA-256 fingerprint.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'AUDIT GUIDE · 2/3',
      mood: 'guide',
      text: '🛡️ Zero Secret Leakage: Log records contain only sanitized virtual paths and public key fingerprints — private keys, passwords, and file contents are strictly filtered.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'AUDIT GUIDE · 3/3',
      mood: 'celebrate',
      text: '⏱️ Automated Pruning: Scheduled audit retention policies keep your database ultra-lean and query responses sub-10ms while preserving necessary compliance histories.',
      action: { label: 'All Files', actionKey: 'open_all_files' },
    },
  ],
  trash: [
    {
      badge: 'TRASH GUIDE · 1/2',
      mood: 'guide',
      text: '🗑️ Two-Stage Deletion: Deleted files land safely here first. You can restore them to their original folders anytime with complete metadata intact.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'TRASH GUIDE · 2/2',
      mood: 'celebrate',
      text: '♻️ Quota Reclamation: Items in the Recycle Bin continue to occupy quota until purged. Empty the Recycle Bin when you are ready to reclaim cloud capacity.',
      action: { label: 'All Files', actionKey: 'open_all_files' },
    },
  ],
  shared: [
    {
      badge: 'SHARING GUIDE · 1/2',
      mood: 'guide',
      text: '🤝 Secure Link Sharing: Share files with a single-click token link. Recipients get read-only access without touching your Google Drive or S3 credentials.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'SHARING GUIDE · 2/2',
      mood: 'celebrate',
      text: '🔒 Hash-Only Isolation: Share tokens are indexed exclusively by cryptographic hash in the database, preventing token enumeration or leakage.',
      action: { label: 'All Files', actionKey: 'open_all_files' },
    },
  ],
  starred: [
    {
      badge: 'STARRED GUIDE · 1/2',
      mood: 'guide',
      text: '⭐ Priority Pinning: Star your most important spreadsheets, code repos, or documents to access them in 1-click without searching through folders.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'STARRED GUIDE · 2/2',
      mood: 'celebrate',
      text: '⚡ Instant Keyboard Star: Select any file and press "s" to toggle starred status instantly!',
      action: { label: 'All Files', actionKey: 'open_all_files' },
    },
  ],
  api: [
    {
      badge: 'API GUIDE · 1/2',
      mood: 'guide',
      text: '⚡ Programmatic Ingestion: Generate scoped API keys for CI/CD pipelines, automated scripts, or headless file synchronization.',
      action: { label: 'Next Tip →', actionKey: 'guide_next' },
    },
    {
      badge: 'API GUIDE · 2/2',
      mood: 'celebrate',
      text: '🛡️ Least-Privilege Scopes: Restrict tokens to read-only or upload-only permissions and restrict allowed IP CIDRs for maximum security.',
      action: { label: 'Settings', actionKey: 'open_settings' },
    },
  ],
}

/**
 * Rich pool of contextual and technical dialogues for Byte
 */
export const EXPANDED_VAULT_TIPS: string[] = [
  "💡 Pro tip: Press '/' or Ctrl+K anywhere to jump instantly to Fast Global Search!",
  "📁 Keep files tidy: drag and drop any file directly onto a folder to move it.",
  "📦 Need to download multiple items? Select files with checkboxes and hit ZIP download!",
  "✨ Star your most important files to quickly access them in the Starred tab.",
  "🎨 Want to change my outfit or colors? Head to Settings → Mascot anytime!",
  "🔒 Everything in your vault is protected with zero-knowledge encryption & SHA-256 pre-hashes.",
  "☕ Self-hosted storage pilot active. Your data stays entirely in your hands.",
  "🏷️ You can filter files by size, date, or type (photos, video, code) in the search bar.",
  "🚀 Fast uploads: drag-and-drop entire folders anywhere across your dashboard.",
  "📂 Virtual folders let you organize files without duplicating disk space.",
  "⌨️ Press '?' anywhere on your keyboard to view all Better Drive shortcut keys.",
  "🛡️ Need a custom profile avatar? Check out the avatar presets in Settings!",
  "🖥️ Termius connection: Port 2222 with Ed25519 keys lets you mount Better Drive on iPhone or Android!",
  "⚡ Did you know? Client pre-hashing runs in a Web Worker to keep 60fps UI buttery smooth.",
  "🧹 Run Clean Duplicates in Quota Tracker to identify redundant copies across all folders.",
  "🗄️ Better Drive works with SQLite by default, but seamlessly scales to PostgreSQL or MySQL.",
  "🔄 You can combine multiple free Google accounts into one huge pooled storage vault!",
  "📱 Access your files on the go: install Better Drive as a PWA on your home screen.",
  "💾 Take regular database snapshots from Settings → Backup to keep your vault metadata safe.",
  "🎯 Double-click me anytime for an instant live diagnostics readout of your storage engines!",
]

export const AIRBORNE_FLIGHT_DIALOGUES: string[] = [
  "Wheee! 🚀 Flying to new coordinates!",
  "Wheee! Cruising across the dashboard! 💨",
  "Wheee! Scouting the vault from above! ✨",
  "Hold on tight! Airborne glide mode engaged! 🛸",
  "Wheee! Relocating to a better vantage point! 🎯",
  "Whoa! Look at that bird's-eye view! 🌌",
]

export const TIME_OF_DAY_GREETINGS = {
  morning: [
    { text: "☀️ Good morning! Storage engines are standing by for your transfers.", badge: "MORNING STANDBY" },
    { text: "☕ Fresh day, clean vault! Ready to organize and upload your morning files.", badge: "SUNRISE SYNC" },
  ],
  afternoon: [
    { text: "⚡ Good afternoon! Multi-cloud pipelines are running fast and nominal.", badge: "PEAK OPS" },
    { text: "🚀 Cruising through the afternoon! Need a hand finding any files?", badge: "VAULT READY" },
  ],
  evening: [
    { text: "🌙 Good evening! All scheduled cloud syncs and integrity checks are quiet and nominal.", badge: "EVENING PATROL" },
    { text: "✨ Winding down? Your files are safely mirrored and backed up in the vault.", badge: "NIGHT SAFE" },
  ],
  night: [
    { text: "🦉 Late night coding session? Your self-hosted vault has your back, operator.", badge: "NIGHT OPS" },
    { text: "🌌 Quiet hours: zero network collisions, maximum transfer throughput.", badge: "DEEP CYCLE" },
  ],
}
