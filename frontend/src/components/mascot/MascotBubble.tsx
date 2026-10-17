import { useId, useMemo, useEffect, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'

export type BubbleShapeType =
  | 'pill-round'
  | 'circle-round'
  | 'comic-slant'
  | 'starburst'
  | 'centered-v'

export type BubblePaletteKey =
  | 'lavender-twilight'
  | 'violet-burst'
  | 'rose-crimson'
  | 'orange-creamsicle'
  | 'magenta-punch'
  | 'lime-olive'
  | 'mint-forest'
  | 'sky-navy'
  | 'butter-amber'
  | 'seafoam-pine'
  | 'coral-terracotta'
  | 'azure-cobalt'
  | 'midnight-neon'

export interface MascotBubbleAction {
  label: string
  onClick: () => void
}

export interface MascotBubbleProps {
  text: string
  badge?: string
  mood?: string
  action?: MascotBubbleAction
  secondaryAction?: MascotBubbleAction
  placement?:
    | 'left'
    | 'right'
    | 'top-right'
    | 'top-center'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left'
    | 'auto'
  className?: string
  shapeSeed?: number
  isDragging?: boolean
  width?: number
  height?: number
  targetMouthX?: number
  theme?: string
  onDismiss?: () => void
}

interface PaletteConfig {
  fill: string
  fillEnd: string
  stroke: string
  text: string
  badge: string
  shadow: string
}

/**
 * 12 Curated Color Themes directly matching the reference template sheet
 */
const PALETTES: Record<BubblePaletteKey, PaletteConfig> = {
  'lavender-twilight': {
    fill: '#EDEBFB',
    fillEnd: '#DFDBF7',
    stroke: '#413D8D',
    text: '#1B184B',
    badge: 'text-indigo-600',
    shadow: 'drop-shadow-[0_12px_24px_rgba(65,61,141,0.22)]',
  },
  'violet-burst': {
    fill: '#F4E7F7',
    fillEnd: '#EBD1F0',
    stroke: '#642E86',
    text: '#2E0E44',
    badge: 'text-purple-600',
    shadow: 'drop-shadow-[0_12px_24px_rgba(100,46,134,0.24)]',
  },
  'rose-crimson': {
    fill: '#FDE8EB',
    fillEnd: '#FAD5DC',
    stroke: '#BA2136',
    text: '#570614',
    badge: 'text-rose-600',
    shadow: 'drop-shadow-[0_12px_24px_rgba(186,33,54,0.25)]',
  },
  'orange-creamsicle': {
    fill: '#FEEFD8',
    fillEnd: '#FDE1BC',
    stroke: '#E65416',
    text: '#692203',
    badge: 'text-amber-600',
    shadow: 'drop-shadow-[0_12px_24px_rgba(230,84,22,0.22)]',
  },
  'magenta-punch': {
    fill: '#FDE3ED',
    fillEnd: '#FACFE0',
    stroke: '#9E165E',
    text: '#4F062E',
    badge: 'text-pink-600',
    shadow: 'drop-shadow-[0_12px_24px_rgba(158,22,94,0.24)]',
  },
  'lime-olive': {
    fill: '#F4F8DE',
    fillEnd: '#EBF3C7',
    stroke: '#748325',
    text: '#2E3607',
    badge: 'text-lime-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(116,131,37,0.2)]',
  },
  'mint-forest': {
    fill: '#E3F5E4',
    fillEnd: '#D2ECD4',
    stroke: '#22693B',
    text: '#09341A',
    badge: 'text-emerald-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(34,105,59,0.22)]',
  },
  'sky-navy': {
    fill: '#E2F1FC',
    fillEnd: '#CFE7F9',
    stroke: '#155DB1',
    text: '#062853',
    badge: 'text-blue-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(21,93,177,0.23)]',
  },
  'butter-amber': {
    fill: '#FFFEE2',
    fillEnd: '#FEFAC6',
    stroke: '#E47616',
    text: '#542701',
    badge: 'text-amber-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(228,118,22,0.2)]',
  },
  'seafoam-pine': {
    fill: '#E1F4F1',
    fillEnd: '#CAEDE7',
    stroke: '#115D56',
    text: '#042A26',
    badge: 'text-teal-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(17,93,86,0.22)]',
  },
  'coral-terracotta': {
    fill: '#FDE6DD',
    fillEnd: '#FBD2C4',
    stroke: '#BD3720',
    text: '#4F1206',
    badge: 'text-orange-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(189,55,32,0.22)]',
  },
  'azure-cobalt': {
    fill: '#E4F1FD',
    fillEnd: '#D2E7FA',
    stroke: '#1761BD',
    text: '#08274F',
    badge: 'text-sky-700',
    shadow: 'drop-shadow-[0_12px_24px_rgba(230,97,189,0.23)]',
  },
  'midnight-neon': {
    fill: '#0c162e',
    fillEnd: '#071022',
    stroke: '#4f46e5',
    text: '#f8fafc',
    badge: 'text-indigo-400',
    shadow: 'drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]',
  },
}

/**
 * Smart Dynamic Bubble Dimensions Calculator
 * Automatically calculates roomy, proportional dimensions so speech text, badges,
 * action pills, and dismiss buttons never feel cramped or clip off.
 */
export function getSmartBubbleDimensions(
  text: string,
  hasAction = false,
  hasBadge = false,
  explicitWidth?: number,
  explicitHeight?: number
): { width: number; height: number } {
  if (explicitWidth && explicitHeight) {
    return { width: explicitWidth, height: explicitHeight }
  }

  const cleanText = (text || '').trim()
  const len = cleanText.length

  // Calculate roomy, proportional width
  let width = explicitWidth ?? 340
  if (!explicitWidth) {
    if (len <= 28 && !hasAction && !hasBadge) {
      width = 270
    } else if (len <= 55 && !hasAction && !hasBadge) {
      width = 305
    } else if (len > 120) {
      width = 365
    } else {
      width = 345
    }
  }

  // Calculate dynamic height based on wrapped text lines, badge, action pill, and tail
  let height = explicitHeight ?? 92
  if (!explicitHeight) {
    // Usable text width inside the bubble accounting for side padding & dismiss button clearance
    const usableTextWidth = Math.max(180, width - 64)
    const charsPerLine = Math.max(22, Math.floor(usableTextWidth / 6.8))

    const words = cleanText.split(/\s+/)
    let estimatedLines = 1
    let currentLineLen = 0

    for (const w of words) {
      if (currentLineLen + w.length + 1 > charsPerLine) {
        estimatedLines++
        currentLineLen = w.length
      } else {
        currentLineLen += (currentLineLen === 0 ? 0 : 1) + w.length
      }
    }

    const explicitLines = cleanText.split('\n').length
    const lineCount = Math.max(estimatedLines, explicitLines, 1)

    // Vertical spacing breakdown:
    // Tail = 15px
    // Top inside padding = 12px
    // Bottom inside padding = 12px
    // Text lines: lineCount * 20px
    // Badge overhead: 22px
    // Action pill overhead: 38px (26px button + 12px margin)
    const basePaddingAndTail = 39
    const badgeHeight = hasBadge ? 22 : 0
    const textHeight = lineCount * 20
    const actionHeight = hasAction ? 38 : 0

    const calculatedHeight = basePaddingAndTail + badgeHeight + textHeight + actionHeight
    const minHeight = hasAction ? 124 : hasBadge ? 104 : 86
    height = Math.max(minHeight, calculatedHeight)
  }

  return { width, height }
}

/**
 * Mascot Speech Bubble Engine
 * - Zero ugly clouds or scallops.
 * - Spacious dimensions dynamically calculated from content length.
 * - Dynamic tail flip: supports top, bottom-left, and bottom-right tails.
 * - Fast typewriter streaming effect with glowing cursor (frozen when dragging).
 */
export function MascotBubble({
  text,
  badge,
  mood = 'idle',
  action,
  secondaryAction,
  placement = 'auto',
  className = '',
  shapeSeed = 0,
  isDragging = false,
  width,
  height,
  targetMouthX,
  theme,
  onDismiss,
}: MascotBubbleProps) {
  const rawId = useId()
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9-_]/g, ''), [rawId])

  const isMobile = placement === 'top-center' || placement === 'bottom-center'

  // Filter out any "Live Engine" text from badge (user explicit instruction)
  const isLiveEngineBadge = badge && /live\s*engine/i.test(badge)
  const displayBadge = badge && !isLiveEngineBadge ? badge : undefined

  // Compute smart spacious dimensions
  const smartDims = useMemo(() => {
    return getSmartBubbleDimensions(
      text || '',
      Boolean(action),
      Boolean(displayBadge),
      width,
      height
    )
  }, [text, action, displayBadge, width, height])

  const W = smartDims.width
  const H = smartDims.height

  // Text hash for deterministic variety across messages
  const textHash = useMemo(() => {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) + shapeSeed
  }, [text, shapeSeed])

  // Fast Typewriter Effect Animation
  const [displayedText, setDisplayedText] = useState(text)
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsTyping(false)
      return
    }

    // When dragging, lock complete text immediately without streaming or cursor pulse
    if (isDragging) {
      setDisplayedText(text)
      setIsTyping(false)
      return
    }

    setDisplayedText('')
    setIsTyping(true)
    let currentIdx = 0

    // Fast, responsive streaming (finishes long sentences in ~350-450ms)
    const step = text.length > 50 ? 2 : 1
    const delayMs = text.length > 50 ? 12 : 15

    const interval = setInterval(() => {
      currentIdx = Math.min(text.length, currentIdx + step)
      setDisplayedText(text.slice(0, currentIdx))

      if (currentIdx >= text.length) {
        clearInterval(interval)
        setIsTyping(false)
      }
    }, delayMs)

    return () => clearInterval(interval)
  }, [text, isDragging])

  // Smart Combo Auto-Selection (Exclusively clean, round, spacious shapes)
  const { shape, paletteKey } = useMemo<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }>(() => {
    const isDark = theme === 'midnight' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
    if (isDark) {
      return { shape: 'pill-round', paletteKey: 'midnight-neon' }
    }

    if (mood === 'error' || mood === 'searching') {
      const errorCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
        { shape: 'starburst', paletteKey: 'rose-crimson' },
        { shape: 'comic-slant', paletteKey: 'rose-crimson' },
        { shape: 'pill-round', paletteKey: 'coral-terracotta' },
      ]
      return isMobile
        ? { shape: 'centered-v', paletteKey: 'rose-crimson' }
        : errorCombos[textHash % errorCombos.length]
    }

    if (mood === 'confused') {
      const confusedCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
        { shape: 'circle-round', paletteKey: 'violet-burst' },
        { shape: 'pill-round', paletteKey: 'lavender-twilight' },
        { shape: 'comic-slant', paletteKey: 'violet-burst' },
      ]
      return isMobile
        ? { shape: 'centered-v', paletteKey: 'lavender-twilight' }
        : confusedCombos[textHash % confusedCombos.length]
    }

    if (mood === 'tour') {
      const tourCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
        { shape: 'pill-round', paletteKey: 'azure-cobalt' },
        { shape: 'comic-slant', paletteKey: 'azure-cobalt' },
        { shape: 'pill-round', paletteKey: 'sky-navy' },
      ]
      return isMobile
        ? { shape: 'centered-v', paletteKey: 'azure-cobalt' }
        : tourCombos[textHash % tourCombos.length]
    }

    if (mood === 'celebrate' || mood === 'submitting') {
      const happyCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
        { shape: 'starburst', paletteKey: 'orange-creamsicle' },
        { shape: 'circle-round', paletteKey: 'magenta-punch' },
        { shape: 'pill-round', paletteKey: 'violet-burst' },
      ]
      return isMobile
        ? { shape: 'centered-v', paletteKey: 'orange-creamsicle' }
        : happyCombos[textHash % happyCombos.length]
    }

    if (mood === 'password' || mood === 'peek') {
      const peekCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
        { shape: 'pill-round', paletteKey: 'magenta-punch' },
        { shape: 'circle-round', paletteKey: 'lavender-twilight' },
        { shape: 'comic-slant', paletteKey: 'magenta-punch' },
      ]
      return isMobile
        ? { shape: 'centered-v', paletteKey: 'magenta-punch' }
        : peekCombos[textHash % peekCombos.length]
    }

    if (isMobile) {
      const mobilePalettes: BubblePaletteKey[] = [
        'sky-navy',
        'lavender-twilight',
        'mint-forest',
        'orange-creamsicle',
        'azure-cobalt',
      ]
      return {
        shape: 'centered-v' as BubbleShapeType,
        paletteKey: mobilePalettes[textHash % mobilePalettes.length],
      }
    }

    const curatedCombos: Array<{ shape: BubbleShapeType; paletteKey: BubblePaletteKey }> = [
      { shape: 'pill-round', paletteKey: 'lavender-twilight' },
      { shape: 'comic-slant', paletteKey: 'rose-crimson' },
      { shape: 'circle-round', paletteKey: 'orange-creamsicle' },
      { shape: 'comic-slant', paletteKey: 'magenta-punch' },
      { shape: 'pill-round', paletteKey: 'lime-olive' },
      { shape: 'comic-slant', paletteKey: 'mint-forest' },
      { shape: 'circle-round', paletteKey: 'sky-navy' },
      { shape: 'circle-round', paletteKey: 'butter-amber' },
      { shape: 'circle-round', paletteKey: 'seafoam-pine' },
      { shape: 'pill-round', paletteKey: 'coral-terracotta' },
      { shape: 'pill-round', paletteKey: 'azure-cobalt' },
    ]

    return curatedCombos[textHash % curatedCombos.length]
  }, [mood, isMobile, textHash, theme])

  // Save active combo
  useEffect(() => {
    try {
      localStorage.setItem(
        'better_drive_mascot_bubble_combo',
        JSON.stringify({ shape, paletteKey, timestamp: Date.now() })
      )
    } catch {
      // ignore
    }
  }, [shape, paletteKey])

  const palette = PALETTES[paletteKey] ?? PALETTES['lavender-twilight']

  // Bubble sits to Byte's left or right; tail points organically to Byte's mouth
  const isLeftPlacement =
    placement === 'left' ||
    placement === 'top-left' ||
    placement === 'bottom-left'

  /**
   * Roomy, Round Vector Paths with Smooth Organic Bezier Curves
   * Tail: broad where it starts on the bubble bottom, thin tapered tip at the end,
   * 15px length pointing naturally towards Byte's mouth.
   */
  // Dynamic Mascot Mouth Tracking for Bubble Tail:
  // Dynamically glides the tail along the bubble's bottom edge, following Byte's position
  // even when the bubble is displaced by window edge guards or custom placements.
  const r = 18
  const baseBottomY = H - 15

  const minCenter = 38
  const maxCenter = Math.max(minCenter, W - 38)
  const tailWidth = 26

  const effectiveTargetX =
    typeof targetMouthX === 'number'
      ? targetMouthX
      : isLeftPlacement
      ? maxCenter
      : minCenter

  // anchorX glides continuously along the flat bottom edge of the bubble
  const anchorX = Math.max(minCenter, Math.min(maxCenter, effectiveTargetX))
  const baseLeft = Math.round(anchorX - tailWidth / 2)
  const baseRight = Math.round(anchorX + tailWidth / 2)

  // tip points dynamically towards Byte's mouth
  const dx = effectiveTargetX - anchorX
  // Tip reaches towards Byte, clamped within safe SVG bounds
  const rawTipX = anchorX + Math.max(-28, Math.min(28, dx * 0.42))
  const tipX = Math.max(6, Math.min(W - 6, Math.round(rawTipX)))
  const tipY = H

  // Dynamic natural curve control points:
  // As tip leans left or right, control points create an organic comic swoop
  const lean = tipX - anchorX
  const cpRightX = Math.round(baseRight + lean * 0.25)
  const cpLeftX = Math.round(baseLeft + lean * 0.25)
  const cpY = baseBottomY + 7

  const pathD = `M ${r + 4} 4 H ${W - r - 4} A ${r} ${r} 0 0 1 ${W - 4} ${r + 4} V ${baseBottomY - r} A ${r} ${r} 0 0 1 ${W - r - 4} ${baseBottomY} H ${baseRight} Q ${cpRightX} ${cpY}, ${tipX} ${tipY} Q ${cpLeftX} ${cpY}, ${baseLeft} ${baseBottomY} H ${r + 4} A ${r} ${r} 0 0 1 4 ${baseBottomY - r} V ${r + 4} A ${r} ${r} 0 0 1 ${r + 4} 4 Z`

  return (
    <div
      className={`group/bubble relative inline-block ${palette.shadow} hover:scale-[1.01] active:scale-[0.99] ${className}`}
      style={{
        transition: isDragging
          ? 'none'
          : 'transform 0.3s cubic-bezier(0.34, 1.25, 0.64, 1), opacity 0.2s ease',
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`${uid}-bubbleGrad`} x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.fill} />
            <stop offset="100%" stopColor={palette.fillEnd} />
          </linearGradient>
        </defs>

        <path
          d={pathD}
          fill={`url(#${uid}-bubbleGrad)`}
          stroke={palette.stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            transition: isDragging ? 'none' : 'fill 0.2s ease, stroke 0.2s ease',
          }}
        />
      </svg>

      {/* Sleek circular dismiss button affordance, cleanly inset and spaced from corner curves */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss?.()
        }}
        className="absolute top-2.5 right-3 flex h-5 w-5 items-center justify-center rounded-full opacity-60 hover:!opacity-100 group-hover/bubble:opacity-85 transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer shadow-xs select-none z-20"
        style={{
          color: palette.stroke,
          backgroundColor: `${palette.stroke}18`,
          border: `1px solid ${palette.stroke}25`,
        }}
        title="Dismiss message"
        aria-label="Dismiss message"
      >
        <X className="h-3 w-3 stroke-[2.4]" />
      </button>

      {/* Roomy HTML Content Overlay: Dedicated clearance for close button, zero text clipping */}
      <div
        className="absolute top-[8px] left-[14px] right-[14px] bottom-[18px] flex flex-col items-center justify-center text-center select-none pl-3 pr-7"
      >
        {displayBadge && (
          <div className={`mb-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${palette.badge}`}>
            <span>{displayBadge}</span>
          </div>
        )}
        <p
          className="text-[12.5px] sm:text-[13px] font-bold leading-normal tracking-tight break-words text-center"
          style={{ color: palette.text }}
        >
          {displayedText}
          {isTyping && !isDragging && (
            <span
              className="inline-block w-1.5 h-3.5 ml-1 align-middle rounded-full animate-pulse opacity-90"
              style={{ backgroundColor: palette.stroke }}
            />
          )}
        </p>
        {(action || secondaryAction) && (
          <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
            {secondaryAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  secondaryAction.onClick()
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95 shadow-xs cursor-pointer select-none"
                style={{
                  backgroundColor: `${palette.stroke}20`,
                  color: palette.stroke,
                  border: `1px solid ${palette.stroke}40`,
                }}
              >
                <span>{secondaryAction.label}</span>
              </button>
            )}
            {action && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick()
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95 shadow-xs cursor-pointer select-none"
                style={{
                  backgroundColor: palette.stroke,
                  color: '#FFFFFF',
                }}
              >
                <span>{action.label}</span>
                <ChevronRight className="h-3 w-3 stroke-[2.4]" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
