import { ClipboardPaste, FolderPlus, Upload } from 'lucide-react'

type Props = {
  x: number
  y: number
  open: boolean
  canPasteFolder?: boolean
  onClose: () => void
  onUpload: () => void
  onCreateFolder: () => void
  onPasteFolder?: () => void
}

function MenuItem({ icon: Icon, label, onClick, accent = false }: { icon: React.ElementType; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150',
        accent
          ? 'text-[var(--accent)] hover:bg-[var(--accent)]/10'
          : 'text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10',
      ].join(' ')}
    >
      <span className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
        accent
          ? 'bg-[var(--accent)]/15 text-[var(--accent)] group-hover:bg-[var(--accent)]/25'
          : 'bg-black/5 text-[var(--app-text-muted)] group-hover:bg-[var(--card-bg)] group-hover:text-[var(--app-text)] group-hover:shadow-sm dark:bg-white/10 dark:text-[var(--app-text-muted)]',
      ].join(' ')}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}

export function EmptyAreaContextMenu({ x, y, open, canPasteFolder = false, onClose, onUpload, onCreateFolder, onPasteFolder }: Props) {
  if (!open) return null
  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228))
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 160))

  return (
    <>
      <button
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close empty area menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-52 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/40 backdrop-blur-2xl"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: '0.75rem', bottom: '0.75rem', position: 'fixed' }
        }
      >
        <div className="p-1.5">
          <MenuItem icon={Upload} label="Upload File" onClick={onUpload} accent />
          <MenuItem icon={FolderPlus} label="New Folder" onClick={onCreateFolder} />
          {canPasteFolder && onPasteFolder ? (
            <>
              <div className="my-1 h-px bg-[var(--card-border)]" />
              <MenuItem icon={ClipboardPaste} label="Paste Folder Here" onClick={onPasteFolder} />
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
