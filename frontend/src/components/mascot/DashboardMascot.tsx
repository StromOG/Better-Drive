import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ByteMascot, type MascotMood } from './ByteMascot'
import { useMascot, clampMascotPosition } from './MascotContext'
import { FirstTimeMascotWelcome } from './FirstTimeMascotWelcome'
import {
  EXPANDED_VAULT_TIPS,
  AIRBORNE_FLIGHT_DIALOGUES,
  TIME_OF_DAY_GREETINGS,
} from './mascotDialogues'

type BubblePlacement =
  | 'left'
  | 'right'
  | 'top-center'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'

interface TourStepConfig {
  targetSelector: string
  title: string
  badge: string
  description: string
  pointerDirection: 'left' | 'right' | 'up'
  preferredPlacement: BubblePlacement
}

const TOUR_STEPS: TourStepConfig[] = [
  {
    targetSelector: 'body',
    badge: 'WELCOME TO BETTER DRIVE',
    title: '👋 Meet Byte, Your Storage Pilot',
    description: "Welcome to Better Drive! I'm Byte, your personal companion. I'll walk you through your high-speed unified vault, zero-copy deduplication, and direct Termius SFTP access.",
    pointerDirection: 'right',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="quota"]',
    badge: 'STEP 1/7 · STORAGE POOL',
    title: '📊 Pooled Cloud Quota & Optimization',
    description: 'All your connected Google Drives and S3 buckets pool seamlessly into one unified quota bar here. Better Drive balances uploads across accounts using intelligent routing.\n\n💡 Pro tip: Run "Clean Duplicates" in Quota Tracker anytime to reclaim wasted cloud quota.',
    pointerDirection: 'left',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="upload"]',
    badge: 'STEP 2/7 · ZERO-COPY UPLOADS',
    title: '🚀 Lightning Uploads & Deduplication',
    description: 'Click here or drag-and-drop entire folders anywhere on screen! Better Drive computes real-time SHA-256 pre-hashes client-side — identical files upload in 20ms without consuming cloud bandwidth.\n\n💡 Pro tip: Files stream in 5MB resumable chunks, safe from connection drops.',
    pointerDirection: 'up',
    preferredPlacement: 'left',
  },
  {
    targetSelector: '[data-tour="search"]',
    badge: 'STEP 3/7 · FAST SEARCH & FILTERS',
    title: '⚡ Instant Global Search across All Drives',
    description: 'Press "/" or Ctrl+K to search across every folder and cloud bucket in under 50ms. Filter results by file type (photos, video, audio, code, archives), account, size, or date range.\n\n💡 Pro tip: Press "?" anywhere on the dashboard to view keyboard shortcuts.',
    pointerDirection: 'up',
    preferredPlacement: 'left',
  },
  {
    targetSelector: '[data-tour="all-files"]',
    badge: 'STEP 4/7 · VIRTUAL FILE SYSTEM',
    title: '📁 Virtual Folders & Batch Operations',
    description: 'Browse your unified folder hierarchy, drag files to move them, and right-click any item for instant sharing, checksums, and renaming.\n\n💡 Pro tip: Select multiple checkboxes to trigger an instant single-archive ZIP download!',
    pointerDirection: 'left',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="termius"]',
    badge: 'STEP 5/7 · SFTP GATEWAY',
    title: '🖥️ Termius & SFTP Direct Streaming',
    description: 'Mount your unified cloud storage inside Termius on iOS, Android, macOS, or Windows via port 2222. Authenticated exclusively via your authorized SSH public keys with zero password leakage.\n\n💡 Pro tip: Head to Termius / SFTP in the sidebar to enroll your public key in 10 seconds.',
    pointerDirection: 'left',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="settings"]',
    badge: 'STEP 6/7 · PROVIDERS & MIGRATION',
    title: '☁️ Cloud Providers & 9Drive Restore',
    description: 'Connect Google Drive & S3 buckets, migrate settings from 9Drive with 1-click restore, download SQLite snapshots, and customize my outfits and color themes!\n\n💡 Pro tip: Drag me to any corner of your screen — I automatically remember my docking spot.',
    pointerDirection: 'left',
    preferredPlacement: 'right',
  },
  {
    targetSelector: '[data-tour="notifications"]',
    badge: 'STEP 7/7 · NOTIFICATIONS & SHORTCUTS',
    title: '🔔 Live System Telemetry & Power Keys',
    description: 'Keep track of real-time background syncs, quota thresholds, and security events right from the notification bell.\n\n💡 Pro tip: Press "?" anytime for the full keyboard shortcuts cheat sheet, or double-click me for live system diagnostics!',
    pointerDirection: 'up',
    preferredPlacement: 'left',
  },
]

const BASE_ALWAYS_TRUE_DIALOGUES = EXPANDED_VAULT_TIPS

function getDynamicDialoguePool(
  telemetry: any,
  liveTips: string[],
  smartSuggestions: boolean,
): string[] {
  const pool = [...BASE_ALWAYS_TRUE_DIALOGUES]

  if (telemetry) {
    if (telemetry.connectedAccountsCount > 0) {
      pool.push(
        "⚡ All connected storage engines and cloud buckets are healthy and fully synced.",
        "🔄 Physical files sync seamlessly to Google Drive and S3 behind the scenes.",
        "☁️ Cloud balance active: Better Drive routes uploads across your connected providers.",
        "📊 Head over to Quota Tracker in the sidebar to see detailed usage charts.",
      )
    } else {
      pool.push(
        "⚠️ No cloud accounts connected yet! Link Google Drive or S3 in Settings to activate pooled storage.",
        "💡 Pro tip: Better Drive can combine multiple free Google accounts into one huge vault!",
        "💾 Currently operating in local SQLite buffer mode. Add an S3 bucket to expand.",
        "☁️ You can connect Cloudflare R2, MinIO, or AWS S3 in Settings → Storage.",
      )
    }

    if (telemetry.fileCount === 0) {
      pool.push(
        "📂 Your storage vault is clean! Drag and drop files or folders anywhere to begin.",
        "🚀 Ready for your first upload: try uploading a file to test zero-copy deduplication!",
      )
    } else {
      pool.push(
        `✨ Vault Status: ${telemetry.fileCount} file(s) safely synced with client-side SHA-256 pre-hashing.`,
        "🔍 Looking for a recent file? Check the breadcrumb navigation in All Files.",
      )
    }

    if (telemetry.duplicateCount > 0) {
      pool.push(
        `⚡ Zero-copy dedup: ${telemetry.duplicateCount} duplicate(s) detected (${telemetry.formattedDuplicateReclaimable} reclaimable in Quota Tracker)!`,
      )
    }

    if (telemetry.trashCount > 0) {
      pool.push(
        `🗑️ Remember to check your Trash (${telemetry.trashCount} items) to free up storage space.`,
      )
    }

    if (telemetry.sftpKeysCount === 0) {
      pool.push(
        "🖥️ Termius ready: Add your SSH public key in Termius / SFTP to mount Better Drive on port 2222!",
      )
    }
  }

  if (smartSuggestions && liveTips.length > 0) {
    // If telemetry says 0 accounts, remove any false claims from liveTips
    const filteredLiveTips = telemetry?.connectedAccountsCount === 0
      ? liveTips.filter(t => !/all storage engines online/i.test(t) && !/buckets? synced/i.test(t))
      : liveTips
    pool.push(...filteredLiveTips)
  }

  return Array.from(new Set(pool))
}

export function DashboardMascot() {
  const {
    mood,
    message,
    badge,
    action,
    secondaryAction,
    accessory,
    theme,
    position,
    isMinimized,
    isTourActive,
    tourStep,
    liveTips,
    telemetry,
    smartInsights,
    enabled,
    showSpeechBubbles,
    smartSuggestions,
    say,
    dismissBubble,
    setPosition,
    persistPosition,
    setIsMinimized,
    nextTourStep,
    prevTourStep,
    skipTour,
    startTour,
    refreshLiveTips,
  } = useMascot()

  const navigate = useNavigate()
  const location = useLocation()

  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragStartPosRef = useRef({ x: 0, y: 0 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const hasDraggedRef = useRef(false)
  const lastInteractionTimeRef = useRef<number>(0)
  const lastDialogueRef = useRef<string>('')
  const lastClickTimeRef = useRef<number>(0)
  const clickCountRef = useRef<number>(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [activePlacement, setActivePlacement] = useState<BubblePlacement>('left')
  const [activePointer, setActivePointer] = useState<'left' | 'right' | 'up'>('left')
  const [flightTilt, setFlightTilt] = useState(0)

  const rafIdRef = useRef<number | null>(null)
  const targetPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastRenderedPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const currentTiltRef = useRef<number>(0)

  const mascotRef = useRef<HTMLDivElement | null>(null)

  // Smart action dispatcher from actionKey
  const executeActionKey = useCallback((actionKey: string) => {
    dismissBubble()
    if (actionKey === 'connect_storage') {
      navigate('/settings/accounts')
    } else if (actionKey === 'open_quota') {
      navigate('/quota')
    } else if (actionKey === 'open_termius') {
      navigate('/termius')
    } else if (actionKey === 'open_trash') {
      navigate('/trash')
    } else if (actionKey === 'open_settings') {
      navigate('/settings')
    } else if (actionKey === 'open_search') {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    } else if (actionKey === 'trigger_upload') {
      const uploadBtn = document.querySelector('[data-tour="upload"]') as HTMLElement
      if (uploadBtn) {
        uploadBtn.click()
      }
    }
  }, [dismissBubble, navigate])

  // Smart natural mouth-level bubble placement:
  // If Byte is on the right half of the screen, bubble naturally extends to his LEFT.
  // If Byte is on the left half of the screen, bubble naturally extends to his RIGHT.
  const calculatePlacement = useCallback((pos: { x: number; y: number }): 'left' | 'right' => {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    return pos.x > winW / 2 ? 'left' : 'right'
  }, [])

  // Default initial position clamped strictly to visible window bounds
  const currentPos = position
    ? clampMascotPosition(position)
    : {
        x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 145) : 1000,
        y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 155) : 700,
      }

  // Update bubble placement whenever Byte moves or docks outside the tour
  useEffect(() => {
    if (!enabled || isTourActive || isDragging) return
    const placement = calculatePlacement({ x: currentPos.x, y: currentPos.y })
    setActivePlacement(placement)
    setActivePointer(placement === 'left' ? 'left' : 'right')
  }, [enabled, currentPos.x, currentPos.y, isTourActive, isDragging, calculatePlacement])

  // Trigger next fresh non-repeating dialogue on click with route intelligence and instant zero latency
  const triggerNextDialogue = useCallback(() => {
    if (isTourActive) return
    const now = Date.now()
    if (now - lastClickTimeRef.current < 250) return // debounce rapid clicks
    lastClickTimeRef.current = now
    lastInteractionTimeRef.current = now

    // 1. Prioritize actionable Smart Insights from backend telemetry (e.g. 0 accounts, 0 files, duplicates, quota alerts)
    if (smartInsights && smartInsights.length > 0) {
      const actionable = smartInsights.filter(
        (i) => i.text !== lastDialogueRef.current && (i.priority >= 75 || Math.random() < 0.45)
      )
      if (actionable.length > 0) {
        const insight = actionable[Math.floor(Math.random() * actionable.length)]
        lastDialogueRef.current = insight.text
        say(
          insight.text,
          insight.mood || 'happy',
          insight.badge,
          7000,
          insight.action
            ? {
                label: insight.action.label,
                onClick: () => executeActionKey(insight.action!.actionKey),
              }
            : undefined
        )
        refreshLiveTips().catch(() => undefined)
        return
      }
    }

    const path = location.pathname.toLowerCase()
    const routeHints: Array<{ text: string; badge?: string; action?: { label: string; onClick: () => void } }> = []

    if (path.includes('quota')) {
      if (telemetry && telemetry.duplicateCount > 0) {
        routeHints.push({
          text: `⚡ Deduplication: ${telemetry.duplicateCount} duplicate file(s) found wasting ${telemetry.formattedDuplicateReclaimable}! Reclaim quota with zero-copy dedup.`,
          badge: "DEDUP SAVINGS",
          action: { label: "Clean Duplicates", onClick: () => {
            const btn = document.querySelector('button:has-text("Clean Duplicates"), button[class*="bg-red"]') as HTMLElement
            btn?.scrollIntoView({ behavior: 'smooth' })
          }}
        })
      }
      routeHints.push(
        { text: "📊 Unified Quota: Google Drive & S3 buckets pool seamlessly into your unified capacity bar.", badge: "QUOTA", action: { label: "Manage Accounts", onClick: () => navigate('/settings') } },
        { text: "⚡ Intelligent Routing: Better Drive automatically routes uploads to the provider with Most Available space.", badge: "ROUTING" }
      )
    } else if (path.includes('settings')) {
      routeHints.push(
        { text: "🔑 Add your Termius SSH public key in SFTP profiles to mount Better Drive on port 2222!", badge: "SFTP GATEWAY", action: { label: "SFTP Setup", onClick: () => navigate('/termius') } },
        { text: "💾 Database Backup & Restore now supports full SQLite binary or Universal JSON archive with auto-rollback!", badge: "BACKUP SAFETY", action: { label: "Backup System", onClick: () => { const el = document.getElementById('backup-restore-card'); el?.scrollIntoView({ behavior: 'smooth' }) } } },
        { text: "🎨 Want a new style? Switch between dark/light mode and 12 custom color palettes in Appearance!", badge: "THEMES" }
      )
    } else if (path.includes('activity')) {
      routeHints.push(
        { text: "📜 Audit Trail: Every upload, deletion, login, and Termius SFTP session is logged here.", badge: "AUDIT LOG", action: { label: "SFTP Settings", onClick: () => navigate('/settings') } },
        { text: "🛡️ Tamper-evident session tracking keeps your self-hosted vault compliant.", badge: "SECURITY" }
      )
    } else if (path.includes('trash')) {
      routeHints.push(
        { text: "🗑️ Items in Trash still consume quota until permanently purged.", badge: "CLEANUP", action: { label: "All Files", onClick: () => navigate('/all-files') } }
      )
    } else if (path.includes('starred')) {
      routeHints.push(
        { text: "⭐ Priority files stay right here for instant access without moving from their folders.", badge: "PINNED", action: { label: "All Files", onClick: () => navigate('/all-files') } }
      )
    } else {
      // Default / All Files view
      if (telemetry?.connectedAccountsCount === 0) {
        routeHints.push(
          { text: "⚠️ No cloud storage connected yet! Files are currently buffered in local SQLite. Link Google Drive or S3 to activate cloud pooling.", badge: "SETUP STORAGE", action: { label: "Connect Storage", onClick: () => navigate('/settings/accounts') } },
          { text: "💡 You can pool multiple Google Drive accounts together to combine their free 15 GB quotas into one vault!", badge: "PRO TIP", action: { label: "Add Google Drive", onClick: () => navigate('/settings/accounts') } }
        )
      } else if (telemetry?.fileCount === 0) {
        routeHints.push(
          { text: "📂 Your vault is ready! Drag and drop files anywhere on the screen or click Upload to test zero-copy uploads.", badge: "GET STARTED", action: { label: "Upload File", onClick: () => executeActionKey('trigger_upload') } }
        )
      } else {
        routeHints.push(
          { text: "🧭 Want a tour of your vault? Tap me 3 times or click below to launch the interactive walkthrough!", badge: "TOUR PILOT", action: { label: "Start Tour", onClick: () => startTour() } },
          { text: "📁 Pro tip: Drag & drop files directly onto folders, or press '/' to search across your vault.", badge: "VAULT", action: { label: "Quota Tracker", onClick: () => navigate('/quota') } },
          { text: "📦 Select multiple files with checkboxes to download a single unified ZIP archive!", badge: "BULK ZIP" }
        )
      }
    }

    // Time-of-day greeting (18% chance)
    const hour = new Date().getHours()
    if (Math.random() < 0.18) {
      const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night'
      const candidates = TIME_OF_DAY_GREETINGS[tod]
      const greeting = candidates[Math.floor(Math.random() * candidates.length)]
      routeHints.push({ text: greeting.text, badge: greeting.badge })
    }

    if (routeHints.length > 0 && Math.random() < 0.65) {
      const hint = routeHints[Math.floor(Math.random() * routeHints.length)]
      if (hint.text !== lastDialogueRef.current) {
        lastDialogueRef.current = hint.text
        say(hint.text, 'guide', hint.badge, 6500, hint.action)
        refreshLiveTips().catch(() => undefined)
        return
      }
    }

    const pool = getDynamicDialoguePool(telemetry, liveTips, smartSuggestions)
    const filtered = pool.filter(
      (d) => d !== lastDialogueRef.current && d !== message
    )
    const candidates = filtered.length > 0 ? filtered : pool
    const pick = candidates[Math.floor(Math.random() * (candidates.length || 1))] || pool[0]

    const randomMoods: MascotMood[] = ['happy', 'thinking', 'zen', 'guide']
    const pickedMood = randomMoods[Math.floor(Math.random() * randomMoods.length)]

    lastDialogueRef.current = pick
    say(pick, pickedMood, undefined, 6000)
    refreshLiveTips().catch(() => undefined)
  }, [isTourActive, smartInsights, telemetry, location.pathname, liveTips, message, smartSuggestions, say, refreshLiveTips, navigate, executeActionKey, startTour])

  // Continuous aerodynamic flight physics animation loop during drag:
  // Dynamically measures velocity between rendered frames for authentic banking,
  // smooth EMA damping, and gentle return to upright (0°) whenever stationary.
  const runDragLoop = useCallback(() => {
    function flightLoop() {
      if (!isDraggingRef.current) return

      const target = targetPosRef.current
      if (target) {
        // Calculate instantaneous horizontal displacement between rendered frames
        const dx = target.x - lastRenderedPosRef.current.x
        lastRenderedPosRef.current = { x: target.x, y: target.y }

        // Aerodynamic velocity-based flight banking:
        // - Moving right (dx > 0) -> banks naturally rightward up to +6.5°
        // - Moving left (dx < 0) -> banks naturally leftward down to -6.5°
        // - Still / Vertical drag (dx === 0) -> targetTilt is 0° (wings level out!)
        const targetTilt = Math.max(-6.5, Math.min(6.5, dx * 0.42))

        // Exponential Moving Average (EMA) damping for silky aerodynamic response
        currentTiltRef.current = currentTiltRef.current * 0.75 + targetTilt * 0.25

        // Clean micro-tremor when leveled out
        const smoothedTilt = Math.abs(currentTiltRef.current) < 0.08 ? 0 : Math.round(currentTiltRef.current * 10) / 10

        setPosition(target)
        setFlightTilt(smoothedTilt)
      }

      rafIdRef.current = requestAnimationFrame(flightLoop)
    }

    rafIdRef.current = requestAnimationFrame(flightLoop)
  }, [setPosition])

  // Cleanup drag animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // Handle Dragging with real-time viewport clamping, aerodynamic glide, and zero HTTP requests
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || isTourActive) return
    if (e.button !== 0) return // primary button only

    lastInteractionTimeRef.current = Date.now()
    isDraggingRef.current = false
    hasDraggedRef.current = false
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }
    dragOffsetRef.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || (!dragStartPosRef.current.x && !dragStartPosRef.current.y)) return

    const dist = Math.hypot(
      e.clientX - dragStartPosRef.current.x,
      e.clientY - dragStartPosRef.current.y
    )
    // 6px drag threshold prevents micro hand-tremor from interrupting clean clicks
    if (dist > 6) {
      if (!isDraggingRef.current) {
        isDraggingRef.current = true
        setIsDragging(true)
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        // Emit airborne Wheee! dialogue on flight launch with speech bubble visible during flight
        const flightQuote =
          AIRBORNE_FLIGHT_DIALOGUES[
            Math.floor(Math.random() * AIRBORNE_FLIGHT_DIALOGUES.length)
          ]
        say(flightQuote, 'celebrate', 'AIRBORNE', 25000)

        lastRenderedPosRef.current = { x: currentPos.x, y: currentPos.y }
        currentTiltRef.current = 0

        // Start continuous RAF aerodynamic physics loop
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        runDragLoop()
      }
      hasDraggedRef.current = true
    } else {
      return
    }

    const minX = 16
    const minY = 16
    const maxX = Math.max(minX, window.innerWidth - 130)
    const maxY = Math.max(minY, window.innerHeight - 130)

    const newX = Math.round(Math.max(minX, Math.min(maxX, e.clientX - dragOffsetRef.current.x)))
    const newY = Math.round(Math.max(minY, Math.min(maxY, e.clientY - dragOffsetRef.current.y)))

    targetPosRef.current = { x: newX, y: newY }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    const wasDragging = hasDraggedRef.current

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }

    isDraggingRef.current = false
    setIsDragging(false)
    currentTiltRef.current = 0
    setFlightTilt(0)
    dragStartPosRef.current = { x: 0, y: 0 }
    lastInteractionTimeRef.current = Date.now()

    if (wasDragging) {
      const settledPos = targetPosRef.current || currentPos
      targetPosRef.current = null
      setPosition(settledPos)
      persistPosition(settledPos)
      const finalPlacement = calculatePlacement(settledPos)
      setActivePlacement(finalPlacement)
      setActivePointer(finalPlacement === 'left' ? 'left' : 'right')
      say("📍 All set! Docked at new vantage point.", 'happy', 'DOCKED', 5000)
    }
  }

  // Cinematic Tour Position Tracking with intelligent element highlighting & avoidance
  useEffect(() => {
    if (!enabled || !isTourActive) {
      setTargetRect(null)
      setFlightTilt(0)
      return
    }

    const currentStepConfig = TOUR_STEPS[tourStep]
    if (!currentStepConfig) {
      skipTour()
      return
    }

    // Step 0: Rendered as high-impact FirstTimeMascotWelcome modal
    if (currentStepConfig.targetSelector === 'body' || tourStep === 0) {
      setTargetRect(null)
      return
    }

    const el = document.querySelector(currentStepConfig.targetSelector)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)

      let targetX: number
      let targetY: number
      let placement: BubblePlacement = currentStepConfig.preferredPlacement

      if (currentStepConfig.targetSelector === '[data-tour="quota"]') {
        // Quota is in sidebar on the left. Byte stands in the open canvas to the right!
        targetX = Math.round(rect.right + 26)
        targetY = Math.max(60, Math.min(window.innerHeight - 180, Math.round(rect.top + 10)))
        placement = 'right'
      } else if (currentStepConfig.targetSelector === '[data-tour="settings"]') {
        // Settings is in sidebar on the left. Byte floats to the right in open space!
        targetX = Math.round(rect.right + 26)
        targetY = Math.max(60, Math.min(window.innerHeight - 180, Math.round(rect.top - 20)))
        placement = 'right'
      } else if (currentStepConfig.targetSelector === '[data-tour="termius"]') {
        // Termius is in sidebar on the left. Byte floats to the right!
        targetX = Math.round(rect.right + 26)
        targetY = Math.max(60, Math.min(window.innerHeight - 180, Math.round(rect.top - 15)))
        placement = 'right'
      } else if (currentStepConfig.targetSelector === '[data-tour="all-files"]') {
        // All Files is in sidebar near top. Byte stands in open canvas to the right!
        targetX = Math.round(rect.right + 26)
        targetY = Math.max(60, Math.min(window.innerHeight - 180, Math.round(rect.top - 15)))
        placement = 'right'
      } else if (currentStepConfig.targetSelector === '[data-tour="upload"]') {
        // Upload is in the top header. Place Byte below it with speech bubble to his left!
        targetX = Math.max(20, Math.min(window.innerWidth - 180, Math.round(rect.left - 60)))
        targetY = Math.round(rect.bottom + 25)
        placement = 'left'
      } else if (currentStepConfig.targetSelector === '[data-tour="search"]') {
        // Search is in the top header. Place Byte centered below the search bar!
        targetX = Math.max(20, Math.min(window.innerWidth - 180, Math.round(rect.left + rect.width / 2 - 55)))
        targetY = Math.round(rect.bottom + 25)
        placement = 'left'
      } else if (currentStepConfig.targetSelector === '[data-tour="notifications"]') {
        // Notification bell is in top header right. Place Byte below it with bubble to his left!
        targetX = Math.max(20, Math.min(window.innerWidth - 180, Math.round(rect.left - 80)))
        targetY = Math.round(rect.bottom + 25)
        placement = 'left'
      } else {
        targetX = Math.round(rect.left)
        targetY = Math.round(rect.top)
      }

      setPosition({ x: targetX, y: targetY })
      setActivePlacement(placement)
      setActivePointer(currentStepConfig.pointerDirection)
      say(currentStepConfig.description, 'tour', currentStepConfig.badge, 0)
    } else {
      setTargetRect(null)
      say(currentStepConfig.description, 'tour', currentStepConfig.badge, 0)
    }
  }, [enabled, isTourActive, tourStep, currentPos.x, setPosition, say, skipTour])

  // Speech Bubble Guided Tour: Non-intrusive step-by-step guides inside Byte's speech bubble
  const showBubbleTourStep = useCallback((step: number) => {
    if (step === 1) {
      say(
        "👋 Welcome to Better Drive! I'm Byte, your storage co-pilot. All your cloud drives pool together here into a single unified vault! 🚀",
        'celebrate',
        'VAULT TOUR • 1/5',
        0,
        {
          label: 'Next: Account Switcher →',
          onClick: () => showBubbleTourStep(2),
        },
        {
          label: 'Close',
          onClick: dismissBubble,
        }
      )
    } else if (step === 2) {
      say(
        "📁 Look up in the header: the Account Switcher lets you switch between 'All (pooled)' and individual connected drives anytime!",
        'happy',
        'VAULT TOUR • 2/5',
        0,
        {
          label: 'Next: Uploads & Folders →',
          onClick: () => showBubbleTourStep(3),
        },
        {
          label: '← Back',
          onClick: () => showBubbleTourStep(1),
        }
      )
    } else if (step === 3) {
      say(
        "⚡ Upload & Folders: Drag & drop files anywhere to upload with SHA-256 deduplication. Click XS, SM, MD, LG to scale folder visuals instantly!",
        'guide',
        'VAULT TOUR • 3/5',
        0,
        {
          label: 'Next: Termius & SFTP →',
          onClick: () => showBubbleTourStep(4),
        },
        {
          label: '← Back',
          onClick: () => showBubbleTourStep(2),
        }
      )
    } else if (step === 4) {
      say(
        "🔑 Termius & SFTP Gateway: Connect on port 2222 with SSH public keys to mount your vault as a native local drive letter!",
        'thinking',
        'VAULT TOUR • 4/5',
        0,
        {
          label: 'Next: Cloud Setup & CLI →',
          onClick: () => showBubbleTourStep(5),
        },
        {
          label: '← Back',
          onClick: () => showBubbleTourStep(3),
        }
      )
    } else if (step === 5) {
      say(
        "⚙️ Cloud Setup & Terminal: Under Settings > Accounts, you'll find step-by-step guides and ready-to-run terminal commands (.env, PowerShell, cURL, S3 CLI, Rclone)!",
        'celebrate',
        'VAULT TOUR • 5/5',
        0,
        {
          label: 'Finish Tour 🎉',
          onClick: () => {
            say("You're all set! Double-click me anytime for live engine diagnostics, or 3-click for this tour! 🌟", 'happy', 'TOUR COMPLETE', 4000)
          },
        },
        {
          label: '← Back',
          onClick: () => showBubbleTourStep(4),
        }
      )
    }
  }, [say, dismissBubble])

  // Click mascot when not in tour:
  // - 1 tap: Fresh non-repeating contextual companion dialogue or smart hint
  // - 2 taps: Live telemetry diagnostics
  // - 3 taps: Launch speech bubble guided tour!
  const handleMascotClick = useCallback(() => {
    if (!enabled || isTourActive || hasDraggedRef.current || isDraggingRef.current) return

    clickCountRef.current += 1
    const currentCount = clickCountRef.current

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }

    if (currentCount >= 3) {
      clickCountRef.current = 0
      showBubbleTourStep(1)
      return
    }

    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0
      if (currentCount === 2) {
        if (!telemetry || telemetry.connectedAccountsCount === 0) {
          say(
            "🔍 Diagnostics: 0 cloud accounts linked! Files currently store in local SQLite buffer. Connect Google Drive or S3 to activate an encrypted cloud pool.",
            'scanning',
            'NO CLOUD LINKED',
            7500,
            {
              label: 'Connect Storage',
              onClick: () => executeActionKey('connect_storage'),
            }
          )
        } else {
          const parts = [
            telemetry.googleAccountsCount > 0 && `${telemetry.googleAccountsCount} Google Drive(s)`,
            telemetry.s3AccountsCount > 0 && `${telemetry.s3AccountsCount} S3 Bucket(s)`,
          ].filter(Boolean).join(' + ')

          say(
            `⚡ Diagnostics nominal: ${parts} pooled! ${telemetry.fileCount} file(s) (${telemetry.formattedSize}) securely indexed with ${telemetry.sftpKeysCount} SFTP key(s) enrolled.`,
            'scanning',
            'ENGINES NOMINAL',
            7500,
            {
              label: 'View Quota',
              onClick: () => executeActionKey('open_quota'),
            }
          )
        }
      } else if (currentCount === 1) {
        triggerNextDialogue()
      }
    }, 280)
  }, [enabled, isTourActive, showBubbleTourStep, telemetry, say, executeActionKey, triggerNextDialogue])

  // Right-click Byte companion to launch the speech bubble tour guide
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    showBubbleTourStep(1)
  }, [showBubbleTourStep])

  // Global Keyboard Shortcut: Ctrl+M / Cmd+M to summon Byte or cycle next dialogue
  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        if (isMinimized) {
          setIsMinimized(false)
        }
        triggerNextDialogue()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isMinimized, setIsMinimized, triggerNextDialogue])


  // Periodic relaxed random dialogue scheduler ("at random time but not very fast")
  useEffect(() => {
    if (!enabled || !showSpeechBubbles || isTourActive) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let isMounted = true

    const scheduleNext = () => {
      // Relaxed interval: between 50s and 110s (average ~80s)
      const delay = Math.floor(50000 + Math.random() * 60000)

      timer = setTimeout(() => {
        if (!isMounted) return

        const now = Date.now()
        const timeSinceInteraction = now - lastInteractionTimeRef.current
        const isBusy = isDraggingRef.current || isTourActive || isMinimized

        // If user recently interacted (within 30s) or mascot is busy/minimized, defer
        if (timeSinceInteraction < 30000 || isBusy) {
          scheduleNext()
          return
        }

        const pool = getDynamicDialoguePool(telemetry, liveTips, smartSuggestions)
        const pick = pool[Math.floor(Math.random() * pool.length)]
        say(pick, 'happy', undefined, 5000)

        if (smartSuggestions) {
          refreshLiveTips().catch(() => undefined)
        }

        scheduleNext()
      }, delay)
    }

    scheduleNext()

    return () => {
      isMounted = false
      if (timer) clearTimeout(timer)
    }
  }, [enabled, showSpeechBubbles, smartSuggestions, isTourActive, isMinimized, liveTips, telemetry, say, refreshLiveTips])

  // Master switch: if disabled in Settings, do not render on dashboard
  if (!enabled) return null

  return (
    <>
      {/* First-Time Welcome Modal (Step 0) */}
      {isTourActive && tourStep === 0 && (
        <FirstTimeMascotWelcome
          onStartTour={nextTourStep}
          onSkip={skipTour}
        />
      )}

      {/* High-Tech SVG Spotlight Mask Cutout (Steps 1-5) */}
      {isTourActive && tourStep > 0 && (
        <div className="fixed inset-0 z-[80] pointer-events-auto transition-opacity duration-500">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <rect
                    x={targetRect.left - 8}
                    y={targetRect.top - 8}
                    width={targetRect.width + 16}
                    height={targetRect.height + 16}
                    rx="18"
                    ry="18"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(11, 15, 25, 0.62)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Luminous neon focus halo framing the highlighted element */}
          {targetRect && (
            <div
              className="absolute rounded-2xl border-2 border-sky-400 shadow-[0_0_35px_rgba(56,189,248,0.7),inset_0_0_15px_rgba(56,189,248,0.25)] pointer-events-none transition-all duration-500 ease-out"
              style={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
            >
              {/* Corner accent glow beads */}
              <span className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />
              <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />
              <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />
              <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />
            </div>
          )}

          {/* Tour Step Controls Floating Bar with Progress Dots & Back / Next Navigation */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-sky-950/40 backdrop-blur-md text-white text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center gap-1.5 mr-1">
              {TOUR_STEPS.slice(1).map((_, idx) => {
                const s = idx + 1
                return (
                  <span
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === tourStep
                        ? 'w-6 bg-sky-400 shadow-[0_0_10px_#38bdf8]'
                        : s < tourStep
                        ? 'w-2 bg-sky-600/70'
                        : 'w-2 bg-slate-700'
                    }`}
                  />
                )
              })}
            </div>
            <span className="text-sky-400 font-black">
              Step {tourStep} of {TOUR_STEPS.length - 1}
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              type="button"
              onClick={prevTourStep}
              className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={skipTour}
              className="px-2.5 py-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                if (tourStep < TOUR_STEPS.length - 1) {
                  nextTourStep()
                } else {
                  skipTour()
                }
              }}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-600 text-white font-black shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <span>{tourStep < TOUR_STEPS.length - 1 ? 'Next' : 'Finish Tour'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* GPU Hardware-Accelerated Mascot Floating Container (Smooth 60fps spring motion, hidden on Step 0) */}
      {!(isTourActive && tourStep === 0) && (
        <div
          ref={mascotRef}
          style={{
            transform: `translate3d(${currentPos.x}px, ${currentPos.y}px, 0)`,
            transition: isDragging
              ? 'none'
              : 'transform 0.65s cubic-bezier(0.34, 1.25, 0.64, 1)',
            willChange: 'transform',
          }}
          className={`fixed top-0 left-0 z-[85] select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          title="Byte Companion • Click for advice • Double-click for diagnostics • 3 taps for tour"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={handleContextMenu}
        >
        {/* Minimized Floating Orb with Custom Mini Byte Character Avatar */}
        {isMinimized ? (
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 via-pink-500 to-rose-400 p-0.5 shadow-xl shadow-pink-500/25 hover:scale-110 active:scale-95 transition"
            title="Expand Byte Mascot"
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-white font-extrabold text-xs">
              <svg viewBox="0 0 36 36" className="h-7 w-7" fill="none">
                <defs>
                  <linearGradient id="orbByteGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#bae6fd" />
                    <stop offset="50%" stopColor="#fbcfe8" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>
                <line x1="18" y1="8" x2="18" y2="3.5" stroke="#f472b6" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="18" cy="3" r="1.8" fill="#38bdf8" />
                <rect x="5" y="7" width="5" height="9" rx="2.5" fill="#38bdf8" transform="rotate(-15 5 7)" />
                <rect x="26" y="5.7" width="5" height="9" rx="2.5" fill="#f472b6" transform="rotate(15 26 5.7)" />
                <circle cx="18" cy="20" r="12.5" fill="url(#orbByteGrad)" stroke="#f472b6" strokeWidth="1" />
                <circle cx="10" cy="22" r="2.2" fill="#fb7185" fillOpacity="0.5" />
                <circle cx="26" cy="22" r="2.2" fill="#fb7185" fillOpacity="0.5" />
                <path d="M 12 17 Q 14.5 14.5 17 17" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M 19 17 Q 21.5 14.5 24 17" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M 16 22 Q 18 24 20 22" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </button>
        ) : (
          <div className="relative">
            {/* Core Mascot with Clean Head and Mouth-Level Speech Bubble */}
            <ByteMascot
              mood={mood}
              message={message}
              badge={badge}
              action={action}
              secondaryAction={secondaryAction}
              accessory={accessory}
              theme={theme}
              pointerDirection={activePointer}
              bubblePlacement={activePlacement}
              size={110}
              isDragging={isDragging}
              tilt={flightTilt}
              containerPos={currentPos}
              showBubble={showSpeechBubbles}
              onClick={handleMascotClick}
              onBubbleClick={dismissBubble}
            />
          </div>
        )}
      </div>
      )}
    </>
  )
}
