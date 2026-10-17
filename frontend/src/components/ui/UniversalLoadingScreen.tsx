import type { ReactElement } from 'react'
import { BrandLogo } from '@/components/drive/BrandLogo'

export interface UniversalLoadingScreenProps {
  /** If true, fills screen. If false, fills parent container. Default: true */
  fullscreen?: boolean
  /** Primary title. Default: 'Better Drive' */
  message?: string
  /** Secondary subtle subtitle. Optional. Default: 'Loading...' */
  submessage?: string
  className?: string
}

export function UniversalLoadingScreen({
  fullscreen = true,
  message = 'Better Drive',
  submessage = 'Loading...',
  className = '',
}: UniversalLoadingScreenProps): ReactElement {
  const containerClasses = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--app-bg)] text-[var(--app-text)] p-6 select-none animate-in fade-in duration-200'
    : 'relative flex flex-col items-center justify-center w-full min-h-[280px] bg-transparent text-[var(--app-text)] p-6 select-none'

  return (
    <div className={`${containerClasses} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 max-w-xs w-full text-center">
        {/* Sleek Minimal Brand Logo */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/10 blur-xl animate-pulse" />
          <BrandLogo className="relative h-12 w-12 drop-shadow-sm transition-transform duration-300" />
        </div>

        {/* Clean Typography */}
        <div className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-[var(--app-text)]">
            {message}
          </h1>
          {submessage && (
            <p className="text-xs font-medium text-[var(--app-text-muted)] tracking-wide">
              {submessage}
            </p>
          )}
        </div>

        {/* Minimalist Shimmer Line */}
        <div className="w-32 h-1 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden relative mt-1">
          <div className="absolute inset-0 w-1/2 rounded-full bg-[var(--accent)] animate-[loader-shimmer_1.5s_infinite_ease-in-out]" />
        </div>
      </div>
    </div>
  )
}

export default UniversalLoadingScreen
