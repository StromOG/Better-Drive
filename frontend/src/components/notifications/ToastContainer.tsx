import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, type ToastItem } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

function ToastItemCard({ toast }: { toast: ToastItem }) {
  const { dismissToast } = useNotifications()
  const navigate = useNavigate()
  const [progress, setProgress] = useState(100)
  const duration = toast.duration ?? 4500

  useEffect(() => {
    if (duration <= 0) return
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remainingPercent = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remainingPercent)
      if (remainingPercent <= 0) {
        clearInterval(interval)
      }
    }, 40)
    return () => clearInterval(interval)
  }, [duration])

  const iconMap = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-[var(--accent)] shrink-0" />,
  }

  const borderMap = {
    success: 'border-emerald-500/30 dark:border-emerald-500/20 shadow-emerald-500/10',
    error: 'border-rose-500/30 dark:border-rose-500/20 shadow-rose-500/10',
    warning: 'border-amber-500/30 dark:border-amber-500/20 shadow-amber-500/10',
    info: 'border-[var(--card-border)] shadow-black/10',
  }

  const progressBgMap = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-[var(--accent)]',
  }

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border bg-[var(--card-bg)] text-[var(--app-text)] shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-right-8 fade-in',
        borderMap[toast.type]
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5">{iconMap[toast.type]}</div>
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-sm font-extrabold text-[var(--app-text)] leading-snug">
            {toast.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--app-text-muted)] leading-relaxed">
            {toast.message}
          </p>
          {toast.link && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id)
                navigate(toast.link!)
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
            >
              <span>{toast.actionLabel || 'View Details'}</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          aria-label="Dismiss toast"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {duration > 0 && (
        <div className="h-1 w-full bg-black/5 dark:bg-white/5">
          <div
            className={cn('h-full transition-all duration-75', progressBgMap[toast.type])}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useNotifications()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex w-[min(calc(100vw-2rem),24rem)] flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItemCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
