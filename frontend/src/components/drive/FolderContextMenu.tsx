import { Copy, Edit3, FolderOpen, Scissors, Trash2, UserPlus } from 'lucide-react'
import type { FolderItem } from '@/data/drive-data'

type Props = {
  x: number
  y: number
  folder: FolderItem | null
  onClose: () => void
  onCut: () => void
  onRename: () => void
  onInvite: () => void
  onCopyLink: () => void
  onDelete: () => void
}

function MenuItem({ icon: Icon, label, onClick, danger = false, kbd }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; kbd?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150',
        danger
          ? 'text-red-500 hover:bg-red-500/10'
          : 'text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10',
      ].join(' ')}
    >
      <span className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
        danger
          ? 'bg-red-500/15 text-red-500 group-hover:bg-red-500/25'
          : 'bg-black/5 text-[var(--app-text-muted)] group-hover:bg-[var(--card-bg)] group-hover:text-[var(--app-text)] group-hover:shadow-sm dark:bg-white/10 dark:text-[var(--app-text-muted)]',
      ].join(' ')}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {kbd && (
        <kbd className="hidden rounded-md border border-[var(--card-border)] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-text-muted)] sm:inline">
          {kbd}
        </kbd>
      )}
    </button>
  )
}

export function FolderContextMenu({ x, y, folder, onClose, onCut, onRename, onInvite, onCopyLink, onDelete }: Props) {
  if (!folder) return null
  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228))
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 280))

  return (
    <>
      <button
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close folder menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl shadow-black/40 backdrop-blur-2xl"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: '0.75rem', bottom: '0.75rem', position: 'fixed' }
        }
      >
        {/* Header */}
        <div className="border-b border-[var(--card-border)] bg-black/5 dark:bg-white/5 px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight text-[var(--app-text)]">{folder.name}</p>
              <p className="text-[10px] font-medium text-[var(--app-text-muted)]">Virtual folder</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <MenuItem icon={Copy} label="Copy Link" onClick={onCopyLink} />
          <MenuItem icon={Scissors} label="Cut" onClick={onCut} kbd="⌘X" />
          <MenuItem icon={Edit3} label="Rename" onClick={onRename} />
          <MenuItem icon={UserPlus} label="Invite Member" onClick={onInvite} />
          <div className="my-1 h-px bg-[var(--card-border)]" />
          <MenuItem icon={Trash2} label="Delete Folder" onClick={onDelete} danger />
        </div>
      </div>
    </>
  )
}
