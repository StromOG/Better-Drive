import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api'
import type { MascotAccessory, MascotColorTheme, MascotMood } from './ByteMascot'
import type { MascotBubbleAction } from './MascotBubble'
import { PLACE_GUIDE_DIALOGUES } from './mascotDialogues'

export interface MascotPosition {
  x: number
  y: number
}

export function clampMascotPosition(pos: { x: number; y: number }): MascotPosition {
  if (typeof window === 'undefined') return pos
  const mascotW = 120
  const mascotH = 120
  const minX = 16
  const minY = 16
  const maxX = Math.max(minX, window.innerWidth - mascotW - 16)
  const maxY = Math.max(minY, window.innerHeight - mascotH - 16)
  return {
    x: Math.round(Math.max(minX, Math.min(maxX, pos.x))),
    y: Math.round(Math.max(minY, Math.min(maxY, pos.y))),
  }
}

export interface MascotSmartInsight {
  id: string
  text: string
  category: 'setup' | 'storage' | 'dedup' | 'sftp' | 'trash' | 'quota' | 'organization' | 'shortcuts'
  mood: MascotMood
  badge?: string
  priority: number
  action?: {
    label: string
    actionKey: string
  }
}

export interface MascotTelemetryData {
  connectedAccountsCount: number
  googleAccountsCount: number
  s3AccountsCount: number
  fileCount: number
  trashCount: number
  starredCount: number
  folderCount: number
  totalBytes: number
  formattedSize: string
  quotaUsedBytes: number
  quotaTotalBytes: number
  quotaPercent: number
  duplicateCount: number
  duplicateReclaimableBytes: number
  formattedDuplicateReclaimable: string
  deduplicatedSavingsBytes: number
  formattedDedupSavings: string
  sftpEnabled: boolean
  sftpProfilesCount: number
  sftpKeysCount: number
  recentFileName: string | null
  primaryGreeting: {
    text: string
    mood: MascotMood
    badge?: string
    action?: {
      label: string
      actionKey: string
    }
  }
  insights: MascotSmartInsight[]
  tips: string[]
}

export interface MascotContextType {
  mood: MascotMood
  message: string
  badge?: string
  action?: MascotBubbleAction
  secondaryAction?: MascotBubbleAction
  accessory: MascotAccessory
  theme: MascotColorTheme
  position: MascotPosition | null
  isMinimized: boolean
  isTourActive: boolean
  tourStep: number
  liveTips: string[]
  telemetry: MascotTelemetryData | null
  smartInsights: MascotSmartInsight[]
  enabled: boolean
  showSpeechBubbles: boolean
  smartSuggestions: boolean
  setMood: (mood: MascotMood) => void
  say: (message: string, mood?: MascotMood, badge?: string, durationMs?: number, action?: MascotBubbleAction, secondaryAction?: MascotBubbleAction) => void
  dismissBubble: () => void
  setAccessory: (acc: MascotAccessory) => void
  setTheme: (t: MascotColorTheme) => void
  setPosition: (pos: MascotPosition | null) => void
  persistPosition: (pos: MascotPosition) => void
  setIsMinimized: (val: boolean) => void
  setEnabled: (val: boolean) => void
  setShowSpeechBubbles: (val: boolean) => void
  setSmartSuggestions: (val: boolean) => void
  resetPosition: () => void
  startTour: () => void
  nextTourStep: () => void
  prevTourStep: () => void
  skipTour: () => void
  refreshLiveTips: () => Promise<void>
  triggerPlaceGuide: (placePath?: string) => void
}

const MascotContext = createContext<MascotContextType | null>(null)

const LOCAL_STORAGE_KEY = 'betterdrive_mascot_config_v1'

function sanitizeAccessory(acc: unknown): MascotAccessory {
  if (acc === 'detective' || acc === 'sunglasses' || acc === 'party' || acc === 'wand') {
    return acc
  }
  return 'none'
}

export function MascotProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<MascotMood>('idle')
  const [message, setMessage] = useState<string>("👋 Hi! I'm Byte, your storage pilot.")
  const [badge, setBadge] = useState<string | undefined>(undefined)
  const [action, setAction] = useState<MascotBubbleAction | undefined>(undefined)
  const [secondaryAction, setSecondaryAction] = useState<MascotBubbleAction | undefined>(undefined)
  const [accessory, setAccessoryState] = useState<MascotAccessory>('none')
  const [theme, setThemeState] = useState<MascotColorTheme>('candy')
  const [position, setPositionState] = useState<MascotPosition | null>(null)
  const [isMinimized, setIsMinimizedState] = useState<boolean>(false)
  const [enabled, setEnabledState] = useState<boolean>(true)
  const [showSpeechBubbles, setShowSpeechBubblesState] = useState<boolean>(true)
  const [smartSuggestions, setSmartSuggestionsState] = useState<boolean>(true)
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false)
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(() => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (local) {
        const parsed = JSON.parse(local)
        if (typeof parsed.hasSeenTour === 'boolean') return parsed.hasSeenTour
      }
    } catch {
      // ignore
    }
    return false
  })
  const [isTourActive, setIsTourActive] = useState<boolean>(false)
  const [tourStep, setTourStep] = useState<number>(0)
  const [telemetry, setTelemetry] = useState<MascotTelemetryData | null>(null)
  const [smartInsights, setSmartInsights] = useState<MascotSmartInsight[]>([])
  const [liveTips, setLiveTips] = useState<string[]>([
    "💡 Pro tip: Press '/' on your keyboard to instantly jump to Fast Global Search!",
    '📁 Drag and drop files or folders anywhere across the screen to upload instantly.',
    '🔒 All files are self-hosted with client-side SHA-256 pre-hashing.',
    '📦 Select multiple files with checkboxes for an instant unified ZIP download!',
  ])

  const sayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshLiveTips = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await apiFetch<{
        tips?: string[]
        telemetry?: MascotTelemetryData
        insights?: MascotSmartInsight[]
        primaryGreeting?: MascotTelemetryData['primaryGreeting']
      }>('/mascot/smart-tips')

      if (data?.telemetry) {
        setTelemetry(data.telemetry)
      }
      if (Array.isArray(data?.insights)) {
        setSmartInsights(data.insights)
      }
      if (Array.isArray(data?.tips) && data.tips.length > 0) {
        setLiveTips(data.tips)
      }

      if (data?.primaryGreeting && !isTourActive) {
        setMessage((curr) => {
          if (!curr || curr.startsWith("👋 Hi! I'm Byte") || curr.includes("storage pilot")) {
            setMood(data.primaryGreeting?.mood || 'happy')
            setBadge(data.primaryGreeting?.badge)
            return data.primaryGreeting?.text || curr
          }
          return curr
        })
      }
    } catch {
      // offline or unauthenticated fallback
    }
  }, [enabled, isTourActive])

  // 1. Load initial settings from localStorage then sync with backend
  useEffect(() => {
    let isLocallyEnabled = true
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (local) {
        const parsed = JSON.parse(local)
        if (parsed.accessory) setAccessoryState(sanitizeAccessory(parsed.accessory))
        if (parsed.theme) setThemeState(parsed.theme)
        if (parsed.position) setPositionState(clampMascotPosition(parsed.position))
        if (typeof parsed.minimized === 'boolean') setIsMinimizedState(parsed.minimized)
        if (typeof parsed.enabled === 'boolean') {
          setEnabledState(parsed.enabled)
          isLocallyEnabled = parsed.enabled
        }
        if (typeof parsed.showSpeechBubbles === 'boolean') setShowSpeechBubblesState(parsed.showSpeechBubbles)
        if (typeof parsed.smartSuggestions === 'boolean') setSmartSuggestionsState(parsed.smartSuggestions)
        if (typeof parsed.hasSeenTour === 'boolean') setHasSeenTour(parsed.hasSeenTour)
      }
    } catch {
      // ignore
    }

    // Async sync with backend
    apiFetch<{ settings: { accessory: MascotAccessory; colorTheme: MascotColorTheme; position: MascotPosition | null; minimized: boolean; hasSeenTour: boolean; enabled?: boolean; showSpeechBubbles?: boolean; smartSuggestions?: boolean } }>('/mascot/settings')
      .then((data) => {
        if (!data?.settings) return
        setAccessoryState(sanitizeAccessory(data.settings.accessory))
        setThemeState(data.settings.colorTheme || 'candy')
        if (data.settings.position) setPositionState(clampMascotPosition(data.settings.position))
        setIsMinimizedState(Boolean(data.settings.minimized))
        if (typeof data.settings.enabled === 'boolean') setEnabledState(data.settings.enabled)
        if (typeof data.settings.showSpeechBubbles === 'boolean') setShowSpeechBubblesState(data.settings.showSpeechBubbles)
        if (typeof data.settings.smartSuggestions === 'boolean') setSmartSuggestionsState(data.settings.smartSuggestions)
        setHasSeenTour(Boolean(data.settings.hasSeenTour))
      })
      .catch(() => {
        // Backend optional fallback
      })
      .finally(() => {
        setSettingsLoaded(true)
      })

    // Initial live storage engine tips fetch only if enabled
    if (isLocallyEnabled) {
      refreshLiveTips()
    }
  }, [refreshLiveTips])

  // Teardown all mascot speech bubbles, timers, and tour when disabled
  useEffect(() => {
    if (!enabled) {
      if (sayTimeoutRef.current) {
        clearTimeout(sayTimeoutRef.current)
        sayTimeoutRef.current = null
      }
      setMessage('')
      setBadge(undefined)
      setAction(undefined)
      setIsTourActive(false)
    }
  }, [enabled])

  // Window resize guard: ensure Byte never gets stranded outside the viewport on window resize
  useEffect(() => {
    if (!enabled) return
    const handleResize = () => {
      setPositionState((prev) => (prev ? clampMascotPosition(prev) : null))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [enabled])

  // Helper to persist changes
  const persist = useCallback((patch: Record<string, unknown>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...existing, ...patch }))
    } catch {
      // ignore
    }

    apiFetch('/mascot/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }).catch(() => {})
  }, [])

  const setAccessory = useCallback((acc: MascotAccessory) => {
    setAccessoryState(acc)
    persist({ accessory: acc })
  }, [persist])

  const setTheme = useCallback((t: MascotColorTheme) => {
    setThemeState(t)
    persist({ colorTheme: t })
  }, [persist])

  // Real-time position update during dragging (0 network calls, 60fps silky smooth)
  const setPosition = useCallback((pos: MascotPosition | null) => {
    setPositionState(pos)
  }, [])

  // Persists position to localStorage and backend ONCE upon pointer drop
  const persistPosition = useCallback((pos: MascotPosition) => {
    const clamped = clampMascotPosition(pos)
    setPositionState(clamped)
    persist({ position: clamped })
  }, [persist])

  const setIsMinimized = useCallback((val: boolean) => {
    setIsMinimizedState(val)
    persist({ minimized: val })
  }, [persist])

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val)
    persist({ enabled: val })
  }, [persist])

  const setShowSpeechBubbles = useCallback((val: boolean) => {
    setShowSpeechBubblesState(val)
    persist({ showSpeechBubbles: val })
  }, [persist])

  const setSmartSuggestions = useCallback((val: boolean) => {
    setSmartSuggestionsState(val)
    persist({ smartSuggestions: val })
  }, [persist])

  const dismissBubble = useCallback(() => {
    if (sayTimeoutRef.current) {
      clearTimeout(sayTimeoutRef.current)
      sayTimeoutRef.current = null
    }
    setMessage('')
    setMood('idle')
    setBadge(undefined)
    setAction(undefined)
    setSecondaryAction(undefined)
  }, [])

  const say = useCallback((
    msg: string,
    m: MascotMood = 'happy',
    b?: string,
    durationMs: number = 5000,
    act?: MascotBubbleAction,
    secAct?: MascotBubbleAction
  ) => {
    if (sayTimeoutRef.current) {
      clearTimeout(sayTimeoutRef.current)
      sayTimeoutRef.current = null
    }
    // Filter out "Live Engine" / "engine" text if ever passed
    const filteredBadge = b && /engine/i.test(b) ? undefined : b
    setMessage(msg)
    setMood(m)
    setBadge(filteredBadge)
    setAction(act)
    setSecondaryAction(secAct)
    if (durationMs > 0) {
      sayTimeoutRef.current = setTimeout(() => {
        setMessage('')
        setMood('idle')
        setBadge(undefined)
        setAction(undefined)
        setSecondaryAction(undefined)
        sayTimeoutRef.current = null
      }, durationMs)
    }
  }, [])

  // Auto-hide initial welcome greeting after 5 seconds
  useEffect(() => {
    sayTimeoutRef.current = setTimeout(() => {
      setMessage('')
      setMood('idle')
      setBadge(undefined)
      sayTimeoutRef.current = null
    }, 5000)
    return () => {
      if (sayTimeoutRef.current) {
        clearTimeout(sayTimeoutRef.current)
        sayTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__betterdrive_say = say
      ;(window as unknown as Record<string, unknown>).__betterdrive_set_mascot_theme = setTheme
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as Record<string, unknown>).__betterdrive_say
        delete (window as unknown as Record<string, unknown>).__betterdrive_set_mascot_theme
      }
    }
  }, [say, setTheme])

  const resetPosition = useCallback(() => {
    const defaultPos = {
      x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 145) : 1000,
      y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 155) : 700,
    }
    persistPosition(defaultPos)
    say("📍 Reset to home base! Docked at bottom-right.", 'happy', undefined, 5000)
  }, [persistPosition, say])

  // Cinematic Tour Controls
  const startTour = useCallback(() => {
    setIsTourActive(true)
    setTourStep(0)
    setIsMinimizedState(false)
  }, [])

  const nextTourStep = useCallback(() => {
    setTourStep((prev) => prev + 1)
  }, [])

  const prevTourStep = useCallback(() => {
    setTourStep((prev) => Math.max(0, prev - 1))
  }, [])

  const skipTour = useCallback(() => {
    setIsTourActive(false)
    setTourStep(0)
    setHasSeenTour(true)
    persist({ hasSeenTour: true })
    say("🪄 I'm docked right here! Drag me anywhere or click me for quick storage tips.", 'happy', undefined, 5000)
  }, [persist, say])

  // Automatically start tour once when a brand-new account is created
  useEffect(() => {
    if (settingsLoaded && !hasSeenTour) {
      const timer = setTimeout(() => {
        startTour()
        setHasSeenTour(true)
        persist({ hasSeenTour: true })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [settingsLoaded, hasSeenTour, startTour, persist])

  const placeGuideStepRef = useRef<Record<string, number>>({})
  const triggerPlaceGuideRef = useRef<(placePath?: string) => void>(() => {})

  const triggerPlaceGuide = useCallback((placePath?: string) => {
    if (!enabled) return
    const rawPath = (placePath || (typeof window !== 'undefined' ? window.location.pathname : '/')).toLowerCase()

    let key = 'all-files'
    if (rawPath.includes('termius') || rawPath.includes('sftp')) key = 'termius'
    else if (rawPath.includes('quota')) key = 'quota'
    else if (rawPath.includes('settings')) key = 'settings'
    else if (rawPath.includes('activity')) key = 'activity'
    else if (rawPath.includes('trash')) key = 'trash'
    else if (rawPath.includes('shared')) key = 'shared'
    else if (rawPath.includes('starred')) key = 'starred'
    else if (rawPath.includes('api')) key = 'api'

    const steps = PLACE_GUIDE_DIALOGUES[key] || PLACE_GUIDE_DIALOGUES['all-files']
    const currentStep = placeGuideStepRef.current[key] ?? 0
    const nextStep = (currentStep + 1) % steps.length
    placeGuideStepRef.current[key] = nextStep

    const stepData = steps[currentStep]
    if (isMinimized) {
      setIsMinimizedState(false)
    }

    say(
      stepData.text,
      stepData.mood || 'guide',
      stepData.badge,
      9500,
      stepData.action
        ? {
            label: stepData.action.label,
            onClick: () => {
              if (stepData.action?.actionKey === 'guide_next') {
                triggerPlaceGuideRef.current(placePath)
              } else if (stepData.action?.actionKey === 'open_shortcuts') {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
              } else if (stepData.action?.actionKey === 'open_activity') {
                window.location.href = '/activity'
              } else if (stepData.action?.actionKey === 'connect_storage') {
                window.location.href = '/settings'
              } else if (stepData.action?.actionKey === 'open_all_files') {
                window.location.href = '/all-files'
              } else if (stepData.action?.actionKey === 'open_settings') {
                window.location.href = '/settings'
              }
            },
          }
        : undefined
    )
  }, [enabled, isMinimized, say])

  useEffect(() => {
    triggerPlaceGuideRef.current = triggerPlaceGuide
  }, [triggerPlaceGuide])

  return (
    <MascotContext.Provider
      value={{
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
        setMood,
        say,
        dismissBubble,
        setAccessory,
        setTheme,
        setPosition,
        persistPosition,
        setIsMinimized,
        setEnabled,
        setShowSpeechBubbles,
        setSmartSuggestions,
        resetPosition,
        startTour,
        nextTourStep,
        prevTourStep,
        skipTour,
        refreshLiveTips,
        triggerPlaceGuide,
      }}
    >
      {children}
    </MascotContext.Provider>
  )
}

export function useMascot() {
  const ctx = useContext(MascotContext)
  if (!ctx) {
    throw new Error('useMascot must be used within a MascotProvider')
  }
  return ctx
}
