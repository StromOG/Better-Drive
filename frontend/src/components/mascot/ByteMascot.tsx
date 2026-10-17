import { useState, useEffect, useRef, useId, useMemo } from 'react'
import { MascotBubble, getSmartBubbleDimensions, type MascotBubbleAction } from './MascotBubble'

export type MascotMood =
  | 'idle'
  | 'email'
  | 'password'
  | 'peek'
  | 'submitting'
  | 'error'
  | 'searching'
  | 'confused'
  | 'happy'
  | 'tour'
  | 'uploading'
  | 'celebrate'
  | 'guide'
  | 'scanning'
  | 'thinking'
  | 'alert'
  | 'zen'

export type MascotAccessory = 'none' | 'detective' | 'sunglasses' | 'party' | 'wand'
export type MascotColorTheme = 'candy' | 'cyan' | 'pink' | 'midnight' | 'mint'

export interface ByteMascotProps {
  mood?: MascotMood
  message?: string
  badge?: string
  action?: MascotBubbleAction
  secondaryAction?: MascotBubbleAction
  accessory?: MascotAccessory
  wand?: boolean | 'left' | 'right' | 'both' | 'none'
  theme?: MascotColorTheme
  className?: string
  pointerDirection?: 'left' | 'right' | 'up' | 'auto'
  bubblePlacement?:
    | 'left'
    | 'right'
    | 'top-right'
    | 'top-center'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left'
    | 'auto'
  onClick?: () => void
  onBubbleClick?: () => void
  onHover?: () => void
  showBubble?: boolean
  size?: number // e.g. 110
  isDragging?: boolean
  tilt?: number
  containerPos?: { x: number; y: number }
  bubbleWidth?: number
  bubbleHeight?: number
}

export function ByteMascot({
  mood = 'idle',
  message = '',
  badge,
  action,
  secondaryAction,
  accessory = 'none',
  wand,
  theme = 'candy',
  className = '',
  pointerDirection = 'right',
  bubblePlacement = 'auto',
  onClick,
  onBubbleClick,
  onHover,
  showBubble = true,
  size = 110,
  isDragging = false,
  containerPos,
  bubbleWidth,
  bubbleHeight,
}: ByteMascotProps) {
  const rawId = useId()
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9-_]/g, ''), [rawId])

  const [isHovered, setIsHovered] = useState(false)
  const [blink, setBlink] = useState(false)
  const [isWaving, setIsWaving] = useState(false)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const [shapeSeed, setShapeSeed] = useState(0)

  const waveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived mood flags
  const isSearching = mood === 'searching' || mood === 'error'
  const isConfused = mood === 'confused'
  const isCoveringEyes = mood === 'password'
  const isPeeking = mood === 'peek'
  const isEmail = mood === 'email'
  const isSubmitting = mood === 'submitting'
  const isTour = mood === 'tour' || mood === 'guide'
  const isGuide = mood === 'guide'
  const isUploading = mood === 'uploading'
  const isCelebrate = mood === 'celebrate'
  const isScanning = mood === 'scanning'
  const isThinking = mood === 'thinking'
  const isAlert = mood === 'alert'
  const isZen = mood === 'zen'
  const isHappy = (mood === 'happy' || isHovered || isWaving) && !isSearching && !isConfused && !isCoveringEyes && !isPeeking && !isSubmitting && !isScanning && !isThinking && !isAlert && !isZen

  // Dynamic bubble placement detection
  const isLeft =
    bubblePlacement === 'left' ||
    bubblePlacement === 'top-left' ||
    bubblePlacement === 'bottom-left'

  const shouldRenderBubble = showBubble && Boolean(message)

  // Magic Wand Dual-Hand Logic:
  // Can be controlled explicitly via `wand` prop ('left' | 'right' | 'both'),
  // or via `accessory === 'wand'`, or dynamically during guided tour or guide mode.
  const isWandAccessory = accessory === 'wand'
  const isTourPointing = (isTour || isGuide) && Boolean(pointerDirection)
  const isWandActive = Boolean(wand) || isWandAccessory || isTourPointing || isGuide
  const isPointingUp = pointerDirection === 'up'

  let effectiveWand: 'left' | 'right' | 'both' | 'none' = 'none'

  if (wand === 'both') {
    effectiveWand = 'both'
  } else if (wand === 'left') {
    effectiveWand = 'left'
  } else if (wand === 'right') {
    effectiveWand = 'right'
  } else if (wand === false || wand === 'none') {
    effectiveWand = 'none'
  } else if (isWandActive) {
    // Intelligent Context-Aware Hand Selection:
    if (isTour && pointerDirection === 'left') {
      effectiveWand = 'left'
    } else if (isTour && pointerDirection === 'right') {
      effectiveWand = 'right'
    } else if (isTour && pointerDirection === 'up') {
      effectiveWand = isLeft ? 'left' : 'right'
    } else if (shouldRenderBubble) {
      // While speaking: hold wand in the hand that faces the speech bubble!
      effectiveWand = isLeft ? 'left' : 'right'
    } else {
      // Idle: follow pointerDirection if specified, otherwise default to right hand
      effectiveWand = pointerDirection === 'left' ? 'left' : 'right'
    }
  }

  const hasLeftWand = effectiveWand === 'left' || effectiveWand === 'both'
  const hasRightWand = effectiveWand === 'right' || effectiveWand === 'both'

  // Periodic natural blinking
  useEffect(() => {
    if (isCoveringEyes || isSearching) return
    const blinkInterval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 160)
    }, 3200 + Math.random() * 2500)
    return () => clearInterval(blinkInterval)
  }, [isCoveringEyes, isSearching])

  // Periodic eye glances in idle
  useEffect(() => {
    if (mood !== 'idle') return
    const glanceInterval = setInterval(() => {
      const glances = [
        { x: 0, y: 0 },
        { x: -2.5, y: 0 },
        { x: 2.5, y: 0 },
        { x: 0, y: -2 },
        { x: -1.5, y: 1.5 },
      ]
      setPupilOffset(glances[Math.floor(Math.random() * glances.length)])
    }, 2800 + Math.random() * 2000)
    return () => clearInterval(glanceInterval)
  }, [mood])

  // Periodic waving in idle
  useEffect(() => {
    if (mood !== 'idle') return
    const waveInterval = setInterval(() => {
      triggerWave(1600)
    }, 9000)
    return () => clearInterval(waveInterval)
  }, [mood])

  function triggerWave(duration = 1800) {
    setIsWaving(true)
    if (waveTimeoutRef.current) clearTimeout(waveTimeoutRef.current)
    waveTimeoutRef.current = setTimeout(() => setIsWaving(false), duration)
  }

  function handleMouseEnter() {
    setIsHovered(true)
    setBlink(true)
    setTimeout(() => setBlink(false), 160)
    triggerWave(1800)
    onHover?.()
  }

  function handleMouseLeave() {
    setIsHovered(false)
  }

  function handleClick() {
    if (isDragging) return
    setShapeSeed((s) => s + 1)
    setBlink(true)
    setTimeout(() => setBlink(false), 180)
    triggerWave(2000)

    onClick?.()
  }

  // Active dialogue passed from state
  const activeMessage = message
  const activeBadge = badge
  const activeMood = isDragging ? 'celebrate' : mood

  // Calculated pupil tracking offsets
  let finalPupilX = pupilOffset.x
  let finalPupilY = pupilOffset.y
  if (isEmail) {
    finalPupilX = -2.5
    finalPupilY = 3.5
  } else if (isThinking) {
    finalPupilX = 3.2
    finalPupilY = -3.2
  } else if (isAlert) {
    finalPupilX = 0
    finalPupilY = 0
  } else if (isGuide) {
    finalPupilX = pointerDirection === 'left' ? -2.8 : pointerDirection === 'right' ? 2.8 : 0
    finalPupilY = pointerDirection === 'up' ? -3 : -1.2
  } else if (isHovered) {
    finalPupilX = 0
    finalPupilY = -2
  } else if (isConfused) {
    finalPupilX = 1
    finalPupilY = -1.5
  } else if (isTour) {
    finalPupilX = pointerDirection === 'left' ? -3 : pointerDirection === 'right' ? 3 : 0
    finalPupilY = pointerDirection === 'up' ? -3.5 : 1
  } else if (shouldRenderBubble) {
    // While talking, glance comfortably towards the speech bubble and user
    finalPupilX = isLeft ? -2.2 : 2.2
    finalPupilY = -1.2
  }

  const isLiveEngineBadge = activeBadge && /live\s*engine/i.test(activeBadge)
  const hasBadge = Boolean(activeBadge && !isLiveEngineBadge)
  const { width: W, height: H } = getSmartBubbleDimensions(
    activeMessage || '',
    Boolean(action),
    hasBadge,
    bubbleWidth,
    bubbleHeight
  )

  // Diagonal coordinates: comfortably close to Byte with mouth-level alignment
  const baseBubbleX = isLeft ? -W - 8 : size + 8
  const baseBubbleY = Math.round(58 - H)

  // Dynamic Viewport Edge Guards: Guarantee the diagonal bubble NEVER clips off the viewport edge
  let bubbleShiftX = 0
  let bubbleShiftY = 0
  if (typeof window !== 'undefined') {
    const winW = window.innerWidth
    const winH = window.innerHeight
    const margin = 16

    if (containerPos) {
      const bubbleAbsLeft = containerPos.x + baseBubbleX
      const bubbleAbsRight = bubbleAbsLeft + W
      const bubbleAbsTop = containerPos.y + baseBubbleY
      const bubbleAbsBottom = bubbleAbsTop + H + 12

      // Horizontal edge guard
      if (bubbleAbsRight > winW - margin) {
        bubbleShiftX = (winW - margin) - bubbleAbsRight
      } else if (bubbleAbsLeft < margin) {
        bubbleShiftX = margin - bubbleAbsLeft
      }

      // Vertical edge guard: if dragged near top of the window, shift gracefully
      if (bubbleAbsTop < margin) {
        bubbleShiftY = margin - bubbleAbsTop
      } else if (bubbleAbsBottom > winH - margin) {
        bubbleShiftY = (winH - margin) - bubbleAbsBottom
      }
    }
  }

  const finalBubbleTransform = `translate3d(${baseBubbleX + bubbleShiftX}px, ${baseBubbleY + bubbleShiftY}px, 0)`

  // Dynamic Mascot Mouth/Head Position in Bubble Coordinates
  // Calculates Byte's center relative to the speech bubble's left edge
  const targetMouthX = Math.round(size / 2 - (baseBubbleX + bubbleShiftX))

  // Dynamic Theme Gradients
  const themeGradients = {
    candy: {
      bodyStart: '#bae6fd',
      bodyMid: '#fbcfe8',
      bodyEnd: '#ffffff',
      earStart: '#38bdf8',
      earEnd: '#f472b6',
      shadow: '#f472b6',
    },
    cyan: {
      bodyStart: '#a5f3fc',
      bodyMid: '#38bdf8',
      bodyEnd: '#ffffff',
      earStart: '#0284c7',
      earEnd: '#06b6d4',
      shadow: '#06b6d4',
    },
    pink: {
      bodyStart: '#fbcfe8',
      bodyMid: '#f472b6',
      bodyEnd: '#ffffff',
      earStart: '#ec4899',
      earEnd: '#fb7185',
      shadow: '#f472b6',
    },
    midnight: {
      bodyStart: '#4338ca',
      bodyMid: '#1e1b4b',
      bodyEnd: '#0f172a',
      earStart: '#818cf8',
      earEnd: '#38bdf8',
      shadow: '#6366f1',
    },
    mint: {
      bodyStart: '#a7f3d0',
      bodyMid: '#6ee7b7',
      bodyEnd: '#ffffff',
      earStart: '#10b981',
      earEnd: '#14b8a6',
      shadow: '#10b981',
    },
  }[theme]

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none cursor-pointer group ${!isDragging ? 'animate-byte-float' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Speech Bubble beside Byte's mouth with butter-smooth 60fps translation (Zero head placement!) */}
      <div
        className={`absolute top-0 left-0 z-30 select-none ${
          shouldRenderBubble
            ? 'opacity-100 scale-100 pointer-events-auto cursor-pointer'
            : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{
          transform: finalBubbleTransform,
          transition: isDragging
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.34, 1.25, 0.64, 1), opacity 0.2s ease, scale 0.2s ease',
          willChange: isDragging ? 'auto' : 'transform',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onBubbleClick?.()
        }}
        title="Click to dismiss"
      >
        <MascotBubble
          text={activeMessage}
          badge={activeBadge}
          mood={activeMood}
          action={action}
          secondaryAction={secondaryAction}
          placement={isLeft ? 'left' : 'right'}
          shapeSeed={shapeSeed}
          isDragging={isDragging}
          width={W}
          height={H}
          targetMouthX={targetMouthX}
          theme={theme}
          onDismiss={onBubbleClick}
        />
      </div>

      {/* SVG Mascot Vector with 60fps Butter-Smooth Transitions */}
      <svg
        width={size}
        height={(size * 100) / 110}
        viewBox="0 0 110 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          transform: isDragging ? 'scale(1.04) translate3d(0, -3px, 0)' : 'none',
          transformOrigin: '50% 50%',
          transition: isDragging
            ? 'none'
            : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className={`${
          theme === 'midnight'
            ? 'drop-shadow-[0_10px_20px_rgba(99,102,241,0.35)]'
            : 'drop-shadow-[0_10px_20px_rgba(244,114,182,0.3)]'
        } select-none pointer-events-auto overflow-visible`}
      >
        <defs>
          {/* Main Body Gradient */}
          <linearGradient id={`${uid}-candyBody`} x1="15" y1="10" x2="95" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={themeGradients.bodyStart} />
            <stop offset="50%" stopColor={themeGradients.bodyMid} />
            <stop offset="100%" stopColor={themeGradients.bodyEnd} />
          </linearGradient>

          {/* Gloss Highlight */}
          <linearGradient id={`${uid}-candyGloss`} x1="55" y1="15" x2="55" y2="45" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Ear Gradient */}
          <linearGradient id={`${uid}-candyEar`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={themeGradients.earStart} />
            <stop offset="100%" stopColor={themeGradients.earEnd} />
          </linearGradient>

          {/* Paw Gradient */}
          <linearGradient id={`${uid}-candyPaw`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme === 'midnight' ? '#1e293b' : '#e0f2fe'} />
            <stop offset="100%" stopColor={theme === 'midnight' ? '#0f172a' : '#fce7f3'} />
          </linearGradient>

          {/* Magnifying Lens Gradient */}
          <linearGradient id={`${uid}-lensGrad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
          </linearGradient>

          {/* Blush Glow */}
          <filter id={`${uid}-blushGlow`} x="0" y="0" width="120" height="120">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
          </filter>

          {/* Magic Wand Gradients & Glow */}
          <linearGradient id={`${uid}-wandShaft`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="50%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          <linearGradient id={`${uid}-wandStar`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="35%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          <filter id={`${uid}-wandGlow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>{`
            /* Mascot SVG Styles */
          `}</style>
        </defs>

        {/* Soft shadow under mascot - lifts dynamically in airborne flight */}
        <ellipse
          cx="55"
          cy="94"
          rx={isDragging ? 26 : 36}
          ry={isDragging ? 3 : 5}
          fill={themeGradients.shadow}
          fillOpacity={isDragging ? 0.15 : 0.25}
          className="transition-all duration-200"
        />

        {/* Antenna / Radar / Question Mark / Guide Compass */}
        <g
          className="transition-transform duration-300 origin-[55px_15px]"
          style={{
            transform: isDragging
              ? 'rotate(-8deg)'
              : isConfused || isThinking
              ? 'rotate(12deg)'
              : isAlert
              ? 'rotate(-6deg)'
              : 'rotate(0deg)',
          }}
        >
          <line
            x1="55"
            y1="18"
            x2="55"
            y2="7"
            stroke={isAlert ? '#ef4444' : isScanning ? '#06b6d4' : '#f472b6'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx="55"
            cy="6"
            r="4.5"
            fill={
              isAlert
                ? '#ef4444'
                : isScanning
                ? '#06b6d4'
                : isSearching
                ? '#f43f5e'
                : isConfused
                ? '#a855f7'
                : isTour || isGuide
                ? '#eab308'
                : '#38bdf8'
            }
          />
          <circle cx="55" cy="6" r="2" fill="#ffffff" />

          {/* Radar waves when searching, scanning, alert, or guide */}
          {(isSearching || isScanning || isAlert || isTour || isGuide) && (
            <circle
              cx="55"
              cy="6"
              r="8"
              stroke={
                isAlert
                  ? '#ef4444'
                  : isScanning
                  ? '#06b6d4'
                  : isTour || isGuide
                  ? '#eab308'
                  : '#f43f5e'
              }
              strokeWidth="1.5"
              fill="none"
              opacity="0.75"
              className="animate-ping"
            />
          )}

          {/* Floating question mark on confused */}
          {isConfused && (
            <g transform="translate(64, 4)">
              <text x="0" y="0" fontSize="13" fontWeight="900" fill="#a855f7" stroke="#ffffff" strokeWidth="0.8" className="animate-bounce">
                ?
              </text>
            </g>
          )}
        </g>

        {/* Left Ear */}
        <g
          style={{
            transformOrigin: '28px 27px',
            transform: isDragging
              ? 'rotate(-20deg) translateY(-2px)'
              : isConfused
              ? 'rotate(-22deg)'
              : isHovered
              ? 'rotate(-16deg)'
              : isSearching
              ? 'rotate(-8deg)'
              : 'rotate(0deg)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <rect
            x="22"
            y="14"
            width="13"
            height="20"
            rx="6.5"
            fill={`url(#${uid}-candyEar)`}
            stroke={theme === 'midnight' ? '#6366f1' : '#ffffff'}
            strokeWidth="1.5"
            transform="rotate(-15 28 24)"
          />
        </g>

        {/* Right Ear */}
        <g
          style={{
            transformOrigin: '82px 27px',
            transform: isDragging
              ? 'rotate(20deg) translateY(-2px)'
              : isConfused
              ? 'rotate(6deg)'
              : isHovered
              ? 'rotate(16deg)'
              : isSearching
              ? 'rotate(8deg)'
              : 'rotate(0deg)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <rect
            x="75"
            y="14"
            width="13"
            height="20"
            rx="6.5"
            fill={`url(#${uid}-candyEar)`}
            stroke={theme === 'midnight' ? '#818cf8' : '#ffffff'}
            strokeWidth="1.5"
            transform="rotate(15 82 24)"
          />
        </g>

        {/* Main Marshmallow Body */}
        <rect
          x="15"
          y="20"
          width="80"
          height="70"
          rx="35"
          fill={`url(#${uid}-candyBody)`}
          stroke={theme === 'midnight' ? '#818cf8' : '#ffffff'}
          strokeWidth="2"
        />

        {/* Glossy Reflection Highlight */}
        <ellipse cx="55" cy="30" rx="28" ry="8" fill={`url(#${uid}-candyGloss)`} opacity={theme === 'midnight' ? 0.45 : 0.85} />

        {/* Rosy Cheeks */}
        <circle
          cx="28"
          cy="61"
          r={isCoveringEyes ? 6.5 : isConfused ? 5.5 : 5}
          fill={theme === 'midnight' ? '#38bdf8' : isConfused ? '#c084fc' : '#f472b6'}
          fillOpacity={theme === 'midnight' ? 0.8 : isCoveringEyes ? 0.8 : 0.6}
          filter={`url(#${uid}-blushGlow)`}
        />
        <circle
          cx="82"
          cy="61"
          r={isCoveringEyes ? 6.5 : isConfused ? 5.5 : 5}
          fill={theme === 'midnight' ? '#38bdf8' : isConfused ? '#c084fc' : '#f472b6'}
          fillOpacity={theme === 'midnight' ? 0.8 : isCoveringEyes ? 0.8 : 0.6}
          filter={`url(#${uid}-blushGlow)`}
        />

        {/* Face Expressions Engine */}
        {isSearching ? (
          /* Detective Searching State with Magnifying Glass */
          <g>
            <ellipse cx="40" cy="52" rx="9" ry="11" fill="#0f172a" />
            <circle cx="40" cy="52" r="4.2" fill="#38bdf8" />
            <circle cx="37" cy="48" r="3" fill="#ffffff" />
            <circle cx="43" cy="55" r="1.5" fill="#ffffff" />

            <g stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none">
              <path d="M 64 53 Q 70 48 76 53" />
            </g>
            <path d="M 63 46 L 77 49" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />

            {/* Magnifying Glass */}
            <g>
              <circle cx="40" cy="52" r="14" stroke="#f472b6" strokeWidth="2.8" fill={`url(#${uid}-lensGrad)`} />
              <path d="M 32 44 A 10.5 10.5 0 0 1 48 44" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
              <line x1="30" y1="62" x2="22" y2="72" stroke="#ec4899" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="62" x2="22" y2="72" stroke="#fbcfe8" strokeWidth="1.8" strokeLinecap="round" />
            </g>

            <path d="M 51 64 Q 55 61 59 64" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        ) : isConfused ? (
          /* Confused Asymmetric State */
          <g>
            <path d="M 33 43 Q 40 38 47 43" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="40" cy="52" rx="7.5" ry="9" fill="#0f172a" />
            <circle cx={40 + finalPupilX} cy={51 + finalPupilY} r="3.2" fill="#a855f7" />
            <circle cx="38" cy="48" r="2.2" fill="#ffffff" />

            <path d="M 64 47 L 76 44" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="70" cy="53" rx="5" ry="6.5" fill="#0f172a" />
            <circle cx="70" cy="53" r="2" fill="#a855f7" />
            <circle cx="69" cy="51" r="1.2" fill="#ffffff" />

            <path d="M 50 64 Q 54 60 58 64 Q 61 67 63 63" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        ) : isScanning ? (
          /* High-Tech Cyber Scanner Eyes with Laser Scan Beam */
          <g>
            <rect x="28" y="44" width="54" height="18" rx="6" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
            <circle cx="39" cy="53" r="3.5" fill="#06b6d4" />
            <circle cx="71" cy="53" r="3.5" fill="#06b6d4" />
            {/* Animated Laser Scan Beam */}
            <line x1="30" y1="53" x2="80" y2="53" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" className="animate-byte-scan" />
            <circle cx="55" cy="53" r="1.5" fill="#ffffff" />
            <path d="M 50 67 L 60 67" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ) : isThinking ? (
          /* Thinking / Analytical Expression */
          <g>
            <path d="M 33 46 Q 40 43 47 47" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M 63 42 Q 70 38 77 43" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            <ellipse cx="40" cy="53" rx="6" ry="6" fill="#0f172a" />
            <ellipse cx="70" cy="51" rx="7" ry="8.5" fill="#0f172a" />
            <circle cx="42" cy="52" r="2.2" fill="#a855f7" />
            <circle cx="73" cy="48" r="3.2" fill="#a855f7" />
            <circle cx="71" cy="46" r="1.8" fill="#ffffff" />
            <path d="M 51 64 Q 55 62 59 65" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            {/* Cute floating thinking spark above ear */}
            <g transform="translate(68, 12) scale(0.75)" className="animate-pulse">
              <circle cx="8" cy="8" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
              <line x1="8" y1="14" x2="8" y2="17" stroke="#ca8a04" strokeWidth="1.5" />
            </g>
          </g>
        ) : isAlert ? (
          /* Vigilant Alert / Warning Eyes */
          <g>
            <path d="M 33 45 L 47 48" stroke="#ef4444" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 63 48 L 77 45" stroke="#ef4444" strokeWidth="2.8" strokeLinecap="round" />
            <ellipse cx="40" cy="53" rx="7" ry="8" fill="#0f172a" />
            <ellipse cx="70" cy="53" rx="7" ry="8" fill="#0f172a" />
            <circle cx="40" cy="53" r="3.5" fill="#f43f5e" />
            <circle cx="70" cy="53" r="3.5" fill="#f43f5e" />
            <circle cx="39" cy="51" r="1.5" fill="#ffffff" />
            <circle cx="69" cy="51" r="1.5" fill="#ffffff" />
            <path d="M 51 65 L 59 65" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ) : isZen ? (
          /* Zen / Chill Curved Eyes */
          <g stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M 33 52 Q 40 47 47 52" />
            <path d="M 63 52 Q 70 47 77 52" />
            <path d="M 51 63 Q 55 67 59 63" strokeWidth="2" />
            <circle cx="23" cy="46" r="1.2" fill="#38bdf8" className="animate-ping" />
            <circle cx="87" cy="46" r="1.2" fill="#ec4899" className="animate-ping" />
          </g>
        ) : isGuide ? (
          /* Navigator Guide Eyes with Star Sparkles */
          <g>
            <ellipse cx="40" cy="52" rx="7" ry="9" fill="#0f172a" />
            <ellipse cx="70" cy="52" rx="7" ry="9" fill="#0f172a" />
            {/* Navigational Star Highlights */}
            <g transform="translate(40, 51) scale(0.65)">
              <polygon points="0,-6 2,-2 6,0 2,2 0,6 -2,2 -6,0 -2,-2" fill="#fde047" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </g>
            <g transform="translate(70, 51) scale(0.65)">
              <polygon points="0,-6 2,-2 6,0 2,2 0,6 -2,2 -6,0 -2,-2" fill="#38bdf8" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </g>
            {/* Cheerful Guide Smile */}
            <path d="M 49 63 Q 55 70 61 63" fill="#f43f5e" />
            <path d="M 49 63 Q 55 70 61 63" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </g>
        ) : isSubmitting || isCelebrate ? (
          /* Star Eyes & Cheerful Open Smile */
          <g>
            <g transform="translate(40, 52) scale(0.9)">
              <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#38bdf8" />
              <polygon points="0,-4 1.2,-1.2 4,0 1.2,1.2 0,4 -1.2,1.2 -4,0 -1.2,-1.2" fill="#ffffff" />
            </g>
            <g transform="translate(70, 52) scale(0.9)">
              <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#f472b6" />
              <polygon points="0,-4 1.2,-1.2 4,0 1.2,1.2 0,4 -1.2,1.2 -4,0 -1.2,-1.2" fill="#ffffff" />
            </g>
            <path d="M 49 62 Q 55 71 61 62" fill="#f43f5e" />
            <path d="M 49 62 Q 55 71 61 62" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </g>
        ) : isCoveringEyes ? (
          /* Bashful Closed Eyes */
          <g>
            <path d="M 34 52 Q 40 48 46 52" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            <path d="M 64 52 Q 70 48 76 52" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            <path d="M 50 63 Q 53 66 55 64 Q 57 66 60 63" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </g>
        ) : isHappy ? (
          /* Happy Arc Eyes */
          <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M 33 51 Q 40 43 47 51" />
            <path d="M 63 51 Q 70 43 77 51" />
            <path d="M 50 63 Q 55 70 60 63" fill="#f43f5e" stroke="none" />
            <path d="M 50 63 Q 55 70 60 63" />
          </g>
        ) : blink ? (
          /* Blinking closed line eyes */
          <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round">
            <line x1="33" y1="52" x2="47" y2="52" />
            <line x1="63" y1="52" x2="77" y2="52" />
            <path d="M 52 64 Q 55 66 58 64" fill="none" />
          </g>
        ) : (
          /* Normal / Attentive Tracking Eyes */
          <g>
            <ellipse
              cx="40"
              cy="52"
              rx="7"
              ry="9"
              fill={theme === 'midnight' ? '#0b132b' : '#0f172a'}
              stroke={theme === 'midnight' ? '#38bdf8' : 'none'}
              strokeWidth="1.2"
            />
            <g
              style={{
                transform: `translate(${finalPupilX}px, ${finalPupilY}px)`,
                transition: 'transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
              }}
            >
              <circle cx="40" cy="51" r="3" fill="#38bdf8" />
              <circle cx="38" cy="48" r="2.2" fill="#ffffff" />
              <circle cx="42" cy="54" r="1.2" fill="#ffffff" />
            </g>

            {isPeeking ? (
              <path
                d="M 64 53 Q 70 46 76 53"
                stroke={theme === 'midnight' ? '#67e8f9' : '#0f172a'}
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <>
                <ellipse
                  cx="70"
                  cy="52"
                  rx="7"
                  ry="9"
                  fill={theme === 'midnight' ? '#0b132b' : '#0f172a'}
                  stroke={theme === 'midnight' ? '#38bdf8' : 'none'}
                  strokeWidth="1.2"
                />
                <g
                  style={{
                    transform: `translate(${finalPupilX}px, ${finalPupilY}px)`,
                    transition: 'transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
                  }}
                >
                  <circle cx="70" cy="51" r="3" fill="#38bdf8" />
                  <circle cx="68" cy="48" r="2.2" fill="#ffffff" />
                  <circle cx="72" cy="54" r="1.2" fill="#ffffff" />
                </g>
              </>
            )}

            <path
              d="M 52 64 Q 55 68 58 64"
              stroke={theme === 'midnight' ? '#67e8f9' : '#0f172a'}
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* Custom Accessories */}
        {accessory === 'detective' && (
          /* Detective Fedora */
          <g transform="translate(28, 6) rotate(-4)">
            <ellipse cx="26" cy="18" rx="26" ry="6" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
            <path d="M 12 16 Q 16 2 26 2 Q 36 2 40 16 Z" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
            <path d="M 12 14 Q 26 13 40 14" stroke="#f59e0b" strokeWidth="3" fill="none" />
          </g>
        )}

        {accessory === 'sunglasses' && (
          /* Cool Aviator Cyber Sunglasses */
          <g transform="translate(26, 42)">
            <rect x="4" y="2" width="22" height="15" rx="5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
            <rect x="32" y="2" width="22" height="15" rx="5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
            <line x1="26" y1="7" x2="32" y2="7" stroke="#e2e8f0" strokeWidth="2" />
            <line x1="8" y1="5" x2="22" y2="12" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
            <line x1="36" y1="5" x2="50" y2="12" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
          </g>
        )}


        {accessory === 'party' && (
          /* Party Hat with Pompom */
          <g transform="translate(42, 0) rotate(8)">
            <polygon points="0,20 14,0 26,18" fill="#ec4899" stroke="#be185d" strokeWidth="1.5" />
            <line x1="5" y1="14" x2="19" y2="6" stroke="#facc15" strokeWidth="3" />
            <line x1="9" y1="18" x2="23" y2="10" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="14" cy="0" r="4" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
          </g>
        )}

        {/* Left Paw Hand Movements */}
        <g
          className="transition-transform duration-200 ease-out"
          style={{
            transformOrigin: '24px 75px',
            transform: isDragging
              ? 'translate(-6px, -15px) rotate(-24deg)'
              : isCoveringEyes
              ? 'translate(21px, -23px) rotate(14deg)'
              : isUploading
              ? 'translate(-4px, -24px) rotate(28deg)'
              : isSearching
              ? 'translate(-2px, -3px) rotate(10deg)'
              : hasLeftWand && isPointingUp
              ? 'translate(-4px, -24px) rotate(26deg)'
              : hasLeftWand && isTour && pointerDirection === 'left'
              ? 'translate(-16px, -18px) rotate(-42deg)'
              : hasLeftWand && shouldRenderBubble && isLeft
              ? 'translate(-12px, -18px) rotate(-34deg)'
              : hasLeftWand
              ? 'translate(-8px, -14px) rotate(-22deg)'
              : !hasLeftWand && hasRightWand && shouldRenderBubble && !isLeft
              ? 'translate(-5px, -8px) rotate(-14deg)'
              : !hasLeftWand && hasRightWand && isPointingUp
              ? 'translate(-2px, -12px) rotate(10deg)'
              : !hasLeftWand && hasRightWand
              ? 'translate(2px, -2px) rotate(4deg)'
              : isThinking
              ? 'translate(14px, -20px) rotate(22deg)'
              : isScanning
              ? 'translate(-4px, -12px) rotate(14deg)'
              : isAlert
              ? 'translate(-2px, -8px) rotate(10deg)'
              : isZen
              ? 'translate(2px, -2px) rotate(2deg)'
              : isConfused
              ? 'translate(12px, -27px) rotate(34deg)'
              : isSubmitting || isCelebrate
              ? 'translate(-3px, -23px) rotate(26deg)'
              : isTour && pointerDirection === 'left'
              ? 'translate(-12px, -18px) rotate(-32deg)'
              : isTour
              ? 'translate(6px, -12px) rotate(12deg)'
              : isPeeking
              ? 'translate(18px, -14px) rotate(10deg)'
              : isEmail
              ? 'translate(14px, -15px) rotate(16deg)'
              : 'translate(0px, 0px)',
            transition: 'transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          {/* Magic Wand Back Handle Grip (behind paw) */}
          {hasLeftWand && (
            <g>
              <line x1="27" y1="81" x2="24" y2="75" stroke={`url(#${uid}-wandShaft)`} strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="28" cy="83" r="2.4" fill="#f59e0b" stroke="#ca8a04" strokeWidth="0.8" />
            </g>
          )}

          <ellipse cx="24" cy="75" rx="9" ry="7" fill={`url(#${uid}-candyPaw)`} stroke={theme === 'midnight' ? '#6366f1' : '#f472b6'} strokeWidth="1.2" />
          <circle cx="24" cy="74" r="3" fill={theme === 'midnight' ? '#38bdf8' : '#f472b6'} fillOpacity={theme === 'midnight' ? 0.75 : 0.4} />

          {/* Magic Wand Upper Shaft, Gem Star & Sparkles (in front of paw) */}
          {hasLeftWand && (
            <g className="filter drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]">
              {/* Wand Upper Shaft */}
              <line x1="24" y1="75" x2="12" y2="52" stroke={`url(#${uid}-wandShaft)`} strokeWidth="3" strokeLinecap="round" />
              <line x1="23" y1="73" x2="13" y2="53" stroke="#fde68a" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
              {/* Gold Ferrule Collar */}
              <ellipse cx="12" cy="52" rx="2.6" ry="1.6" transform="rotate(30 12 52)" fill="#f59e0b" stroke="#fde68a" strokeWidth="0.8" />

              {/* Star Gem and Aura locked directly to wand tip (10, 48) */}
              <g transform="translate(10, 48)">
                {/* Glowing Aura with breathing animation */}
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill="#fde047"
                  fillOpacity="0.35"
                  filter={`url(#${uid}-wandGlow)`}
                >
                  <animate attributeName="r" values="8; 12; 8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.25; 0.45; 0.25" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* 4-Point Faceted Crystal Star Head with shimmer pulse */}
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="1; 1.15; 1"
                    keyTimes="0; 0.5; 1"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <polygon
                    points="0,-10 2.4,-2.4 10,0 2.4,2.4 0,10 -2.4,2.4 -10,0 -2.4,-2.4"
                    fill={`url(#${uid}-wandStar)`}
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                  {/* Inner Bright Diamond Core */}
                  <polygon
                    points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5"
                    fill="#ffffff"
                  />
                  <circle cx="0" cy="0" r="1.2" fill="#fffbeb" />

                  {/* Stardust motes orbiting tip with subtle twinkle */}
                  <g>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 0 0"
                      to="360 0 0"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                    <circle cx="-7" cy="-7" r="1.6" fill="#38bdf8" />
                    <circle cx="7" cy="-5" r="1.2" fill="#f472b6" />
                    <polygon points="0,-2.5 0.7,-0.7 2.5,0 0.7,0.7 0,2.5 -0.7,0.7 -2.5,0 -0.7,-0.7" transform="translate(-6, 6) scale(0.8)" fill="#fde047" />
                  </g>
                </g>
              </g>

              {/* Magic Cast Sparkle Trail towards speech bubble */}
              {shouldRenderBubble && isLeft && (
                <g opacity="0.9">
                  <circle cx="4" cy="38" r="1.5" fill="#38bdf8" />
                  <circle cx="-2" cy="30" r="1.8" fill="#fde047" />
                  <polygon points="0,-2 0.6,-0.6 2,0 0.6,0.6 0,2 -0.6,0.6 -2,0 -0.6,-0.6" transform="translate(-8, 22) scale(0.9)" fill="#f472b6" />
                </g>
              )}
            </g>
          )}
        </g>

        {/* Right Paw Hand Movements */}
        <g
          className="transition-transform duration-200 ease-out"
          style={{
            transformOrigin: '86px 75px',
            transform: isDragging
              ? 'translate(6px, -15px) rotate(24deg)'
              : isCoveringEyes
              ? 'translate(-21px, -23px) rotate(-14deg)'
              : isUploading
              ? 'translate(4px, -24px) rotate(-28deg)'
              : isSearching
              ? 'translate(-10px, -24px) rotate(-28deg)'
              : hasRightWand && isPointingUp
              ? 'translate(4px, -24px) rotate(-26deg)'
              : hasRightWand && isTour && pointerDirection === 'right'
              ? 'translate(16px, -18px) rotate(42deg)'
              : hasRightWand && shouldRenderBubble && !isLeft
              ? 'translate(12px, -18px) rotate(34deg)'
              : hasRightWand
              ? 'translate(8px, -14px) rotate(22deg)'
              : !hasRightWand && hasLeftWand && shouldRenderBubble && isLeft
              ? 'translate(5px, -8px) rotate(14deg)'
              : !hasRightWand && hasLeftWand && isPointingUp
              ? 'translate(2px, -12px) rotate(-10deg)'
              : !hasRightWand && hasLeftWand
              ? 'translate(-2px, -2px) rotate(-4deg)'
              : isConfused
              ? 'translate(6px, -12px) rotate(22deg)'
              : isSubmitting || isCelebrate
              ? 'translate(3px, -23px) rotate(-26deg)'
              : isTour && pointerDirection === 'left'
              ? 'translate(-4px, -12px) rotate(-12deg)'
              : isTour
              ? 'translate(12px, -18px) rotate(30deg)'
              : isPeeking
              ? 'translate(-4px, -10px) rotate(-8deg)'
              : isWaving
              ? 'translate(-2px, -24px) rotate(-26deg)'
              : isHovered
              ? 'translate(-1px, -14px) rotate(-16deg)'
              : 'translate(0px, 0px)',
            transition: 'transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          {/* Magic Wand Back Handle Grip (behind paw) */}
          {hasRightWand && (
            <g>
              <line x1="83" y1="81" x2="86" y2="75" stroke={`url(#${uid}-wandShaft)`} strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="82" cy="83" r="2.4" fill="#f59e0b" stroke="#ca8a04" strokeWidth="0.8" />
            </g>
          )}

          <ellipse cx="86" cy="75" rx="9" ry="7" fill={`url(#${uid}-candyPaw)`} stroke={theme === 'midnight' ? '#6366f1' : '#f472b6'} strokeWidth="1.2" />
          <circle cx="86" cy="74" r="3" fill={theme === 'midnight' ? '#38bdf8' : '#f472b6'} fillOpacity={theme === 'midnight' ? 0.75 : 0.5} />
          <circle cx="83" cy="72" r="1.2" fill={theme === 'midnight' ? '#38bdf8' : '#f472b6'} fillOpacity={theme === 'midnight' ? 0.75 : 0.4} />
          <circle cx="89" cy="72" r="1.2" fill={theme === 'midnight' ? '#38bdf8' : '#f472b6'} fillOpacity={theme === 'midnight' ? 0.75 : 0.4} />

          {/* Magic Wand Upper Shaft, Gem Star & Sparkles (in front of paw) */}
          {hasRightWand && (
            <g className="filter drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]">
              {/* Wand Upper Shaft */}
              <line x1="86" y1="75" x2="98" y2="52" stroke={`url(#${uid}-wandShaft)`} strokeWidth="3" strokeLinecap="round" />
              <line x1="87" y1="73" x2="97" y2="53" stroke="#fde68a" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
              {/* Gold Ferrule Collar */}
              <ellipse cx="98" cy="52" rx="2.6" ry="1.6" transform="rotate(-30 98 52)" fill="#f59e0b" stroke="#fde68a" strokeWidth="0.8" />

              {/* Star Gem and Aura locked directly to wand tip (100, 48) */}
              <g transform="translate(100, 48)">
                {/* Glowing Aura with breathing animation */}
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill="#fde047"
                  fillOpacity="0.35"
                  filter={`url(#${uid}-wandGlow)`}
                >
                  <animate attributeName="r" values="8; 12; 8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.25; 0.45; 0.25" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* 4-Point Faceted Crystal Star Head with shimmer pulse */}
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="1; 1.15; 1"
                    keyTimes="0; 0.5; 1"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <polygon
                    points="0,-10 2.4,-2.4 10,0 2.4,2.4 0,10 -2.4,2.4 -10,0 -2.4,-2.4"
                    fill={`url(#${uid}-wandStar)`}
                    stroke="#ffffff"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                  {/* Inner Bright Diamond Core */}
                  <polygon
                    points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5"
                    fill="#ffffff"
                  />
                  <circle cx="0" cy="0" r="1.2" fill="#fffbeb" />

                  {/* Stardust motes orbiting tip with subtle twinkle */}
                  <g>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 0 0"
                      to="360 0 0"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                    <circle cx="7" cy="-7" r="1.6" fill="#38bdf8" />
                    <circle cx="-7" cy="-5" r="1.2" fill="#f472b6" />
                    <polygon points="0,-2.5 0.7,-0.7 2.5,0 0.7,0.7 0,2.5 -0.7,0.7 -2.5,0 -0.7,-0.7" transform="translate(6, 6) scale(0.8)" fill="#fde047" />
                  </g>
                </g>
              </g>

              {/* Magic Cast Sparkle Trail towards speech bubble */}
              {shouldRenderBubble && !isLeft && (
                <g opacity="0.9">
                  <circle cx="106" cy="38" r="1.5" fill="#38bdf8" />
                  <circle cx="112" cy="30" r="1.8" fill="#fde047" />
                  <polygon points="0,-2 0.6,-0.6 2,0 0.6,0.6 0,2 -0.6,0.6 -2,0 -0.6,-0.6" transform="translate(118, 22) scale(0.9)" fill="#f472b6" />
                </g>
              )}
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
