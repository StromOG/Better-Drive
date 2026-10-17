import { useState, useCallback, type ReactNode } from 'react'
import { Bot, MessageSquare, Lightbulb, RotateCcw, Check, Eye, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ByteMascot, type MascotAccessory, type MascotColorTheme, type MascotMood } from './ByteMascot'
import { useMascot } from './MascotContext'

interface AccessoryOption {
  id: MascotAccessory
  label: string
  reactionText: string
  icon: ReactNode
}

interface ColorThemeOption {
  id: MascotColorTheme
  label: string
  color: string
  reactionText: string
}

const ACCESSORIES: AccessoryOption[] = [
  {
    id: 'none',
    label: 'None',
    reactionText: 'Standard appearance equipped.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="rgba(244,114,182,0.25)" />
      </svg>
    ),
  },
  {
    id: 'detective',
    label: 'Fedora',
    reactionText: 'Fedora equipped.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7 drop-shadow-sm" fill="none">
        <ellipse cx="16" cy="22" rx="14" ry="4" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
        <path d="M 8 20 C 10 9, 22 9, 24 20 Z" fill="#92400e" stroke="#451a03" strokeWidth="1.2" />
        <path d="M 8 18 Q 16 16.5 24 18" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="12" r="1.5" fill="#fde68a" />
      </svg>
    ),
  },
  {
    id: 'sunglasses',
    label: 'Shades',
    reactionText: 'Sunglasses equipped.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7 drop-shadow-sm" fill="none">
        <rect x="2" y="10" width="12" height="9" rx="3.5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.2" />
        <rect x="18" y="10" width="12" height="9" rx="3.5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.2" />
        <line x1="14" y1="13" x2="18" y2="13" stroke="#e2e8f0" strokeWidth="1.6" />
        <line x1="4" y1="12" x2="12" y2="17" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
        <line x1="20" y1="12" x2="28" y2="17" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
      </svg>
    ),
  },
  {
    id: 'party',
    label: 'Party',
    reactionText: 'Party hat equipped.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7 drop-shadow-sm" fill="none">
        <polygon points="7,25 16,5 25,25" fill="#ec4899" stroke="#be185d" strokeWidth="1.2" />
        <line x1="10" y1="19" x2="22" y2="19" stroke="#facc15" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="13" y1="13" x2="19" y2="13" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="16" cy="5" r="3" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        <circle cx="24" cy="8" r="1.2" fill="#fb7185" />
        <circle cx="8" cy="10" r="1.2" fill="#38bdf8" />
      </svg>
    ),
  },
  {
    id: 'wand',
    label: 'Wand',
    reactionText: 'Magic wand equipped! ✨',
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7 drop-shadow-sm" fill="none">
        <line x1="8" y1="24" x2="19" y2="11" stroke="#312e81" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="9" y1="23" x2="18" y2="12" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" />
        <circle cx="7" cy="25" r="1.6" fill="#f59e0b" />
        <ellipse cx="19" cy="11" rx="1.6" ry="1" transform="rotate(-40 19 11)" fill="#f59e0b" />
        <polygon points="23,4 24.5,8 28.5,9.5 24.5,11 23,15 21.5,11 17.5,9.5 21.5,8" fill="#fde047" stroke="#ffffff" strokeWidth="0.7" strokeLinejoin="round" />
        <polygon points="23,6.5 23.8,8.5 25.8,9.5 23.8,10.5 23,12.5 22.2,10.5 20.2,9.5 22.2,8.5" fill="#ffffff" />
        <circle cx="27" cy="5" r="1.2" fill="#38bdf8" />
        <circle cx="17" cy="14" r="1" fill="#f472b6" />
      </svg>
    ),
  },
]

const COLOR_THEMES: ColorThemeOption[] = [
  { id: 'candy', label: 'Pastel', color: 'from-sky-300 via-pink-300 to-rose-300', reactionText: 'Pastel color equipped.' },
  { id: 'cyan', label: 'Cyan', color: 'from-cyan-400 to-blue-500', reactionText: 'Cyan color equipped.' },
  { id: 'pink', label: 'Rose', color: 'from-pink-300 to-rose-400', reactionText: 'Rose color equipped.' },
  { id: 'midnight', label: 'Midnight', color: 'from-slate-700 via-purple-900 to-slate-900', reactionText: 'Midnight color equipped.' },
  { id: 'mint', label: 'Mint', color: 'from-emerald-300 to-teal-400', reactionText: 'Mint color equipped.' },
]

export function MascotSettingsCard() {
  const {
    accessory,
    theme,
    enabled,
    showSpeechBubbles,
    smartSuggestions,
    setAccessory,
    setTheme,
    setEnabled,
    setShowSpeechBubbles,
    setSmartSuggestions,
    resetPosition,
  } = useMascot()

  // Interactive Live Studio Preview state
  const [previewMood, setPreviewMood] = useState<MascotMood>('happy')
  const [previewTilt, setPreviewTilt] = useState(0)

  // Persisted collapse state to save screen real-estate on the Settings page
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('better_drive_mascot_card_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('better_drive_mascot_card_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const triggerPreviewReaction = useCallback((mood: MascotMood = 'celebrate') => {
    setPreviewMood(mood)
    setPreviewTilt(6)
    setTimeout(() => setPreviewTilt(-4), 160)
    setTimeout(() => setPreviewTilt(0), 380)
    setTimeout(() => setPreviewMood('happy'), 3500)
  }, [])

  return (
    <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] transition-all duration-300">
      {/* Section Header */}
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition-all duration-300 ${
          isCollapsed ? 'border-b-0 pb-0 mb-0' : 'border-b border-[var(--card-border)] pb-4 mb-5'
        }`}
      >
        <div
          onClick={toggleCollapse}
          className="flex items-center gap-2.5 cursor-pointer select-none group/title"
          title={isCollapsed ? 'Click to expand companion studio' : 'Click to collapse companion studio'}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-400 via-pink-500 to-rose-400 text-white shadow-xs group-hover/title:scale-105 transition-transform duration-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-black text-[var(--app-text)] group-hover/title:text-pink-500 transition-colors">
              Mascot & Storage Companion (Byte)
            </h2>
            <p className="text-xs font-semibold text-[var(--app-text-muted)]">
              Customize Byte&apos;s accessories, colors, expressions, and smart file suggestions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mt-2 sm:mt-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${
              enabled
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {enabled ? 'Byte Active' : 'Byte Disabled'}
          </span>

          {/* Quick Collapse / Expand Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-bold text-[var(--app-text)] shadow-xs transition-all duration-200 hover:bg-slate-500/10 hover:border-pink-500/40 active:scale-95 cursor-pointer select-none"
            title={isCollapsed ? 'Expand companion studio' : 'Collapse companion studio'}
            aria-expanded={!isCollapsed}
          >
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-300 ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr] animate-in fade-in duration-300">
        {/* Left Column: Interactive Live Studio Stage */}
        <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--card-border)] bg-gradient-to-b from-slate-500/5 to-slate-500/15 p-6 text-center relative overflow-hidden group">
          <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-[var(--app-text-muted)]">
            <Eye className="h-3.5 w-3.5 text-pink-500" />
            Live Preview
          </div>

          {/* Interactive Byte Preview */}
          {/* Interactive Byte Preview (Hero Centered) */}
          <div
            className="my-4 transition-transform duration-300 ease-out flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
            style={{ transform: `rotate(${previewTilt}deg)` }}
            onClick={() => triggerPreviewReaction('celebrate')}
            title="Click Byte to watch him react!"
          >
            <ByteMascot
              mood={previewMood}
              accessory={accessory}
              theme={theme}
              size={135}
              showBubble={false}
            />
          </div>

          <p className="text-xs font-bold text-[var(--app-text-muted)] mt-2 max-w-[220px] leading-relaxed">
            Click Byte or change styles below to watch him react in real time!
          </p>
        </div>

        {/* Right Column: Customization Controls */}
        <div className="space-y-6">
          {/* Master & Behavioral Toggles */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--app-text)] mb-3">
              Companion Behavior & Toggles
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {/* Master Switch */}
              <div
                onClick={() => setEnabled(!enabled)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition select-none ${
                  enabled
                    ? 'border-pink-500/50 bg-pink-500/5'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-70'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                    enabled ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-pink-500" />
                    Show Byte on Dashboard
                  </span>
                  <p className="text-[11px] font-semibold text-[var(--app-text-muted)] mt-0.5">
                    Toggle your companion on or off from the main file manager.
                  </p>
                </div>
              </div>

              {/* Speech Bubbles Switch */}
              <div
                onClick={() => setShowSpeechBubbles(!showSpeechBubbles)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition select-none ${
                  showSpeechBubbles
                    ? 'border-sky-500/50 bg-sky-500/5'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-70'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                    showSpeechBubbles ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      showSpeechBubbles ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
                    Speech Bubbles
                  </span>
                  <p className="text-[11px] font-semibold text-[var(--app-text-muted)] mt-0.5">
                    Show speech bubbles beside Byte&apos;s mouth.
                  </p>
                </div>
              </div>

              {/* Smart File & Folder Suggestions Switch */}
              <div
                onClick={() => setSmartSuggestions(!smartSuggestions)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition select-none ${
                  smartSuggestions
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-70'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
                    smartSuggestions ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      smartSuggestions ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-500" />
                    Smart File & Storage Tips
                  </span>
                  <p className="text-[11px] font-semibold text-[var(--app-text-muted)] mt-0.5">
                    Proactive tips for trash cleanup, quota warnings, and folders.
                  </p>
                </div>
              </div>

              {/* Reset Position Button */}
              <div
                onClick={resetPosition}
                className="flex items-start gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 cursor-pointer hover:border-pink-400 hover:bg-pink-500/5 transition select-none"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-[var(--app-text)]">
                  <RotateCcw className="h-4 w-4 text-pink-500" />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-[var(--app-text)]">
                    Reset Docked Position
                  </span>
                  <p className="text-[11px] font-semibold text-[var(--app-text-muted)] mt-0.5">
                    Snap Byte back to the bottom-right corner of the dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Vector Icon Pack: Accessories & Hats */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--app-text)] mb-2.5">
              Hats & Accessories
            </h3>
            <div className="grid grid-cols-5 gap-2.5">
              {ACCESSORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAccessory(item.id)
                    triggerPreviewReaction('celebrate')
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3 text-xs font-bold border transition cursor-pointer ${
                    accessory === item.id
                      ? 'border-pink-500 bg-pink-500/10 text-pink-600 ring-2 ring-pink-500/30 shadow-md shadow-pink-500/15 dark:text-pink-400'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] hover:border-pink-300 hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center">{item.icon}</div>
                  <span className="mt-1.5 text-[11px] font-black">{item.label}</span>
                  {accessory === item.id && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-extrabold text-pink-600 dark:text-pink-400">
                      <Check className="h-2.5 w-2.5" /> Equipped
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette Selector */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--app-text)] mb-2.5">
              Color Palette
            </h3>
            <div className="grid grid-cols-5 gap-2.5">
              {COLOR_THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTheme(item.id)
                    triggerPreviewReaction('happy')
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3 text-xs font-bold border transition cursor-pointer ${
                    theme === item.id
                      ? 'border-pink-500 bg-pink-500/10 text-pink-600 ring-2 ring-pink-500/30 shadow-md shadow-pink-500/15 dark:text-pink-400'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] hover:border-pink-300 hover:scale-[1.02]'
                  }`}
                >
                  <span className={`h-6 w-6 rounded-full bg-gradient-to-tr ${item.color} shadow-sm ring-2 ring-white/60 dark:ring-slate-800`} />
                  <span className="mt-1.5 text-[11px] font-black">{item.label}</span>
                  {theme === item.id && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-extrabold text-pink-600 dark:text-pink-400">
                      <Check className="h-2.5 w-2.5" /> Active
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </Card>
  )
}
