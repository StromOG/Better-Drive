import { Gauge, Zap, Terminal, Search, ArrowRight, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ByteMascot } from './ByteMascot'
import { useMascot } from './MascotContext'

interface FirstTimeMascotWelcomeProps {
  onStartTour: () => void
  onSkip: () => void
}

export function FirstTimeMascotWelcome({ onStartTour, onSkip }: FirstTimeMascotWelcomeProps) {
  const { theme } = useMascot()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="relative overflow-hidden w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 text-[var(--app-text)] shadow-2xl shadow-sky-950/20 dark:shadow-black/60 backdrop-blur-2xl flex flex-col animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mascot-welcome-title"
      >
        {/* Subtle Arctic Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-500" />

        {/* Soft Ambient Radial Sheen */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-sky-400/10 dark:bg-sky-500/10 blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onSkip}
          className="absolute top-4 right-4 z-10 rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Byte Pedestal */}
        <div className="relative pt-8 pb-3 px-6 sm:px-8 text-center flex flex-col items-center">
          {/* Byte Character Pedestal */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Ambient Backlight Glow */}
            <div className="absolute h-28 w-28 rounded-full bg-sky-400/20 dark:bg-sky-500/25 blur-xl pointer-events-none" />

            {/* Frosted Pedestal Plate with Soft Floating Animation */}
            <div className="relative flex items-center justify-center p-2 rounded-full bg-gradient-to-b from-sky-100/60 via-white/80 to-sky-50/40 dark:from-sky-900/30 dark:via-slate-800/80 dark:to-slate-900/60 border border-sky-200/60 dark:border-sky-500/25 shadow-lg shadow-sky-500/10 transition-transform duration-500 hover:scale-105">
              <ByteMascot
                mood="celebrate"
                size={110}
                theme={theme || 'candy'}
                accessory="none"
                wand="right"
                showBubble={false}
              />
            </div>
          </div>

          <h2
            id="mascot-welcome-title"
            className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 dark:text-white leading-tight"
          >
            Meet Byte, Your Cloud Vault Pilot
          </h2>
          <p className="mt-1.5 text-xs sm:text-[13px] font-medium text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Welcome to Better Drive! Here is how your self-hosted vault is engineered to be faster, lighter, and far more capable:
          </p>
        </div>

        {/* 4 Clean Core Features (No vertical overflow / scrollbar clipping) */}
        <div className="px-6 sm:px-8 py-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Feature 1: Pooled Storage */}
            <div className="group rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex items-start gap-3 hover:border-sky-400/40 dark:hover:border-sky-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform duration-200">
                <Gauge className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px]">
                  Pooled Storage Quota
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  Combine multiple Google Drives and S3 buckets into one unified vault with auto-balancing.
                </p>
              </div>
            </div>

            {/* Feature 2: Deduplication */}
            <div className="group rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex items-start gap-3 hover:border-amber-400/40 dark:hover:border-amber-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform duration-200">
                <Zap className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px]">
                  Zero-Copy Deduplication
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  SHA-256 pre-hashes match existing files in 20ms — saving upload time and cloud bandwidth.
                </p>
              </div>
            </div>

            {/* Feature 3: Termius & SFTP */}
            <div className="group rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex items-start gap-3 hover:border-indigo-400/40 dark:hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                <Terminal className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px]">
                  Termius & SFTP Gateway
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  Mount cloud storage directly on iOS, macOS, and Linux over port 2222 with SSH public keys.
                </p>
              </div>
            </div>

            {/* Feature 4: Search & Previews */}
            <div className="group rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex items-start gap-3 hover:border-emerald-400/40 dark:hover:border-emerald-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
                <Search className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px]">
                  Fast Search & Previews
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sub-50ms search with Ctrl+K, plus native playback for Audio, Video, Syntax Code, & PDFs.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Architecture Note */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 py-2 px-3 flex items-center justify-center gap-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>100% Self-Hosted & AES-256 Encrypted · Private Host Keys · Zero Tracking</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 px-6 sm:px-8 mt-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer py-1"
          >
            Explore on My Own
          </button>

          <Button
            type="button"
            onClick={onStartTour}
            className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold shadow-md shadow-sky-500/20 hover:scale-[1.02] active:scale-95 transition-all text-xs h-9.5 px-5 gap-2 cursor-pointer"
          >
            <span>Start Interactive Tour (7 Steps)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

