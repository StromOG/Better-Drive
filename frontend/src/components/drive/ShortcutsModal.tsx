import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

interface ShortcutRow {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutRow[]
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Global & System',
    shortcuts: [
      { keys: ['/'], description: 'Focus fast global search' },
      { keys: ['Ctrl', 'K'], description: 'Jump to search bar' },
      { keys: ['Ctrl', '['], description: 'Toggle collapsible sidebar' },
      { keys: ['?'], description: 'Open keyboard shortcuts sheet' },
      { keys: ['\\'], description: 'Toggle light / dark appearance' },
      { keys: ['Ctrl', 'M'], description: 'Summon Byte mascot companion' },
      { keys: ['Esc'], description: 'Close modals, drawers, or dismiss search' },
    ],
  },
  {
    title: 'Quick Navigation (Chord: g then key)',
    shortcuts: [
      { keys: ['g', 'h'], description: 'Go to Dashboard' },
      { keys: ['g', 'f'], description: 'Go to All Files & Folders' },
      { keys: ['g', 's'], description: 'Go to Starred Favorites' },
      { keys: ['g', 'r'], description: 'Go to Recent Files' },
      { keys: ['g', 't'], description: 'Go to Recycle Bin' },
      { keys: ['g', 'k'], description: 'Go to API Keys Gateway' },
      { keys: ['g', 'p'], description: 'Go to Profile & Themes' },
      { keys: ['g', 'a'], description: 'Go to Storage Accounts & Guides' },
      { keys: ['g', 'm'], description: 'Go to Team Members' },
      { keys: ['g', 'q'], description: 'Go to Quota & Analytics' },
    ],
  },
  {
    title: 'File & Folder Actions',
    shortcuts: [
      { keys: ['u'], description: 'Upload new files to current folder' },
      { keys: ['c'], description: 'Create new virtual folder' },
      { keys: ['s'], description: 'Toggle star / favorite on selected file' },
      { keys: ['r'], description: 'Rename active file or folder (or F2)' },
      { keys: ['x'], description: 'Toggle file selection checkbox' },
      { keys: ['Ctrl', 'A'], description: 'Select all files in active view' },
      { keys: ['Del'], description: 'Move selected items to recycle bin' },
      { keys: ['Ctrl', 'X'], description: 'Cut folder to clipboard' },
      { keys: ['Ctrl', 'V'], description: 'Paste folder into current location' },
    ],
  },
  {
    title: 'Browse, View & Preview',
    shortcuts: [
      { keys: ['Space'], description: 'Quick preview (Image, Audio, Code, Text, PDF)' },
      { keys: ['v'], description: 'Toggle between Grid and List view' },
      { keys: ['j', 'k'], description: 'Navigate down / up across files' },
      { keys: ['Enter'], description: 'Open folder or preview active file' },
      { keys: ['Shift', 'Click'], description: 'Range select multiple files' },
    ],
  },
]

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--card-border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-sm">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-lg font-black tracking-tight text-[var(--app-text)]">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">
                Speed up file organization and navigation with quick keybinds
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Close shortcuts modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="mt-5 grid gap-5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/40 p-3.5">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--accent)] mb-3">
                {section.title}
              </h3>
              <div className="space-y-2.5">
                {section.shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--app-text-muted)] leading-tight">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex min-w-[22px] items-center justify-center px-1.5 py-0.5 text-[11px] font-mono font-bold rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--card-border)] pt-4 text-xs font-medium text-[var(--app-text-muted)]">
          <span>Press <kbd className="font-mono font-bold px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--app-bg)] text-[var(--app-text)] text-[10px]">?</kbd> anywhere to reopen</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
