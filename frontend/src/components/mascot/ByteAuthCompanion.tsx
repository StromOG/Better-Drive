import { useState, useEffect } from 'react'
import { ByteMascot, type MascotMood } from './ByteMascot'

export type { MascotMood } from './ByteMascot'

export function isGibberish(text: string): boolean {
  if (!text || text.trim().length < 5) return false
  const trimmed = text.trim().toLowerCase()

  // If an email address or handle is typed, test only the user portion before '@'
  const checkPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
  if (!checkPart || checkPart.length < 5) return false

  // Repeated same character 4+ times (e.g. 'aaaaaa', '111111')
  if (/(.)\1{3,}/.test(checkPart)) return true

  // Obvious keyboard row smash sequences
  const smashSubstrings = [
    'asdfg', 'sdfgh', 'dfghj', 'fghjk', 'ghjkl',
    'qwerty', 'wertyu', 'ertyui', 'rtyuio', 'tyuiop',
    'zxcvb', 'xcvbn', 'cvbnm',
    '12345', '23456', '34567', '45678', '56789',
    'lkjhg', 'kjhgf', 'jhgfd', 'hgfed', 'gfdsa',
    'poiuy', 'oiuyt', 'iuytr', 'uytre', 'ytrew'
  ]
  if (smashSubstrings.some((seq) => checkPart.includes(seq))) return true

  // 7+ consecutive consonants in a single token without vowels or digits (e.g. 'sdfghjkl')
  const pureLetters = checkPart.replace(/[^a-z]/g, ' ')
  const tokens = pureLetters.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (/[bcdfghjklmnpqrstvwxyz]{7,}/i.test(token)) return true
  }

  // Obvious repeated multi-char chunks (e.g. 'asdasdasd')
  if (/(.{2,3})\1{2,}/.test(checkPart)) return true

  return false
}

export const BYTE_AUTH_DIALOGUES = [
  "👋 Hi! I'm Byte, your personal security companion!",
  "🔒 Your password is protected with zero-knowledge Argon2id hashing!",
  "🛡️ Client-side AES-256 safeguards your files before they leave your machine.",
  "👀 I won't peek at your password, promise!",
  "🎯 Pro tip: Click the eye icon anytime to check your password characters.",
  "✨ Ready to jump into your secure vault? Sign in right here.",
  "💎 Better Drive is 100% self-hosted, private, and telemetry-free.",
  "🚀 Tip: Use 'Sign in with Google' for fast, 1-click authentication!",
  "💌 Creating a new account takes less than 10 seconds!",
  "🔐 Remember to use a strong password with letters, numbers, and symbols.",
  "☕ Welcome back! Your encrypted vault is waiting for you.",
  "🔑 Admin can easily issue an instant reset token if you ever lose access.",
  "🛡️ SQLite local database keeps your auth session strictly on this machine.",
  "🎨 Tap or click me to cycle my speech styles and colors!",
  "🌟 Fast, secure, and modern authentication engineered for privacy.",
  "⌨️ Take your time typing — I'll keep your credentials secure!",
  "🪄 Your personal zero-lock-in storage vault is ready for you.",
]

export interface ByteAuthCompanionProps {
  mood?: MascotMood
  errorMessage?: string
  className?: string
  bubblePlacement?: 'left' | 'right' | 'top-right' | 'top-center' | 'top-left' | 'auto'
  size?: number
  isMobile?: boolean
  pointerDirection?: 'left' | 'right' | 'up' | 'auto'
}

/**
 * Byte Mascot Authentication Companion
 * Provides natural mouth-level speech bubbles and responsive companionship for login and registration.
 */
export function ByteAuthCompanion({
  mood = 'idle',
  errorMessage = '',
  className = '',
  bubblePlacement = 'right',
  size,
  isMobile = false,
  pointerDirection,
}: ByteAuthCompanionProps) {
  const [dialogue, setDialogue] = useState(BYTE_AUTH_DIALOGUES[0])
  const [bubbleDismissed, setBubbleDismissed] = useState(false)

  // Contextual text resolution
  let displayMessage = dialogue
  let badge: string | undefined = undefined

  if (errorMessage) {
    displayMessage = errorMessage
    badge = 'Vault Check'
  } else if (mood === 'searching' || mood === 'error') {
    displayMessage = "🔍 Searching our records... could not find a matching account!"
    badge = 'Searching Vault'
  } else if (mood === 'confused') {
    displayMessage = "🤔 Wait... is that a typo or secret alien code?"
    badge = 'Wait What?'
  } else if (mood === 'password') {
    displayMessage = "🙈 No peeking! Your password is secure!"
  } else if (mood === 'peek') {
    displayMessage = "👀 Peekaboo! Checking your password characters!"
  } else if (mood === 'submitting') {
    displayMessage = "🚀 Connecting to your personal storage vault..."
  }

  // Auto-hide generic dialogues after 5 seconds
  useEffect(() => {
    if (mood === 'idle' && !errorMessage) {
      setBubbleDismissed(false)
      const timer = setTimeout(() => {
        setBubbleDismissed(true)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setBubbleDismissed(false)
    }
  }, [mood, errorMessage, dialogue])

  function handleMascotClick() {
    setBubbleDismissed(false)
    setDialogue((prev) => {
      const candidates = BYTE_AUTH_DIALOGUES.filter((d) => d !== prev)
      return candidates[Math.floor(Math.random() * candidates.length)] || BYTE_AUTH_DIALOGUES[0]
    })
  }

  // Normalized placement: on mobile use top-center, on desktop use natural diagonal
  const resolvedPlacement = isMobile
    ? 'top-center'
    : (bubblePlacement === 'left' || bubblePlacement === 'top-left' ? 'left' : 'right')

  const effectiveSize = size ?? (isMobile ? 78 : 115)
  const bubbleWidth = isMobile ? 240 : undefined
  const bubbleHeight = undefined
  const effectivePointer = pointerDirection ?? (isMobile ? 'right' : 'left')

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <ByteMascot
        mood={mood}
        message={displayMessage}
        badge={badge}
        bubblePlacement={resolvedPlacement}
        bubbleWidth={bubbleWidth}
        bubbleHeight={bubbleHeight}
        pointerDirection={effectivePointer}
        onClick={handleMascotClick}
        onBubbleClick={() => setBubbleDismissed(true)}
        showBubble={!bubbleDismissed}
        theme="candy"
        size={effectiveSize}
      />
    </div>
  )
}
