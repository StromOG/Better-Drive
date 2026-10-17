import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DriveModal({ open, title, description, children, onClose, className }: { open: boolean; title: string; description: string; children: ReactNode; onClose: () => void; className?: string }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close modal" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] p-5 shadow-2xl shadow-black/40 sm:max-w-md sm:rounded-2xl transition-colors duration-200 animate-in zoom-in-95 duration-200', className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--app-text)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">{description}</p>
          </div>
          <Button variant="outline" size="icon" aria-label="Close modal" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-5 min-w-0">{children}</div>
      </div>
    </div>
  )
}

export const DummyModal = DriveModal
export const Modal = DriveModal
