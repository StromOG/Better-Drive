import { FolderOpen, MoreVertical, Star } from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { AvatarStack } from '@/components/drive/AvatarStack'
import { FileIcon } from '@/components/drive/FileIcon'
import type { FileItem } from '@/data/drive-data'
import { apiFetch } from '@/lib/api'

export function FileTable({ files, mode = 'default', selectedFileIds = new Set<string>(), allSelected = false, onFileContextMenu, onToggleFile, onToggleAll }: { files: FileItem[]; mode?: 'default' | 'shared' | 'recent' | 'starred' | 'archived'; selectedFileIds?: Set<string>; allSelected?: boolean; onFileContextMenu?: (event: MouseEvent<HTMLElement>, file: FileItem) => void; onToggleFile?: (file: FileItem) => void; onToggleAll?: () => void }) {
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null)

  return (
    <div className="mt-4">
      {/* Mobile card view */}
      <div className="grid gap-2.5 sm:hidden">
        {onToggleAll ? (
          <label className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] px-4 py-3 text-sm font-bold shadow-sm">
            <span>Select all files</span>
            <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={allSelected} onChange={onToggleAll} />
          </label>
        ) : null}
        {files.map((file) => {
          const selected = selectedFileIds.has(file.id ?? '')
          const meta = mode === 'archived' ? file.location : mode === 'recent' ? file.openedDate : mode === 'starred' ? file.starredDate : file.date
          return (
            <article key={file.id ?? file.name} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', file.id ?? ''); event.dataTransfer.effectAllowed = 'move' }} onClick={() => onToggleFile?.(file)} onContextMenu={(event) => onFileContextMenu?.(event, file)} className={selected ? 'overflow-hidden rounded-2xl border border-[var(--accent)] bg-[var(--card-bg)] p-3.5 shadow-sm cursor-grab active:cursor-grabbing ring-1 ring-[var(--accent)]' : 'overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-sm cursor-grab active:cursor-grabbing'}>
              <div className="flex items-center gap-3">
                {onToggleFile ? <input type="checkbox" className="h-4 w-4 shrink-0 accent-blue-600" checked={selected} onChange={() => onToggleFile?.(file)} onClick={(event) => event.stopPropagation()} /> : null}
                <div className="shrink-0">{mode === 'starred' ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <FileIcon kind={file.kind} />}</div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="truncate text-sm font-black leading-snug text-[var(--app-text)]" title={file.name}>{file.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
                    <span>{meta}</span>
                    <span>·</span>
                    <span>{file.size}</span>
                    {file.folderName && <><span>·</span><span className="flex items-center gap-0.5 text-blue-500 font-bold"><FolderOpen className="h-3 w-3" />{file.folderName}</span></>}
                  </div>
                </div>
                <button className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--app-text-muted)] hover:bg-slate-500/10" onClick={(event) => { event.stopPropagation(); onFileContextMenu?.(event, file) }} aria-label={`Open ${file.name} menu`}><MoreVertical className="h-4 w-4" /></button>
              </div>
            </article>
          )
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)] text-[var(--app-text)]">
              <th className="w-9 py-2.5"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={allSelected} onChange={onToggleAll} /></th>
              <th className="py-2.5 font-black text-[var(--app-text)]">Name</th>
              {mode === 'default' ? <th className="py-2.5 font-black text-[var(--app-text-muted)]">Folder</th> : null}
              {mode === 'shared' ? <th className="py-2.5 font-black text-[var(--app-text)]">Owner</th> : null}
              {mode === 'recent' ? <th className="py-2.5 font-black text-[var(--app-text)]">Last Opened</th> : null}
              {mode === 'starred' ? <th className="py-2.5 font-black text-[var(--app-text)]">Starred On</th> : null}
              {mode === 'archived' ? <th className="py-2.5 font-black text-[var(--app-text)]">Archived Date</th> : null}
              {mode === 'archived' ? <th className="py-2.5 font-black text-[var(--app-text)]">Original Location</th> : <th className="py-2.5 font-black text-[var(--app-text)]">Last Modified</th>}
              <th className="py-2.5 font-black text-[var(--app-text)]">Size</th>
              <th className="py-2.5 font-black text-[var(--app-text)]">Access</th>
              <th className="py-2.5" />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id ?? file.name} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', file.id ?? ''); event.dataTransfer.effectAllowed = 'move' }} onContextMenu={(event) => onFileContextMenu?.(event, file)} onClick={() => onToggleFile?.(file)} className={selectedFileIds.has(file.id ?? '') ? 'group border-b border-[var(--card-border)] bg-orange-500/10 transition hover:bg-orange-500/15 cursor-grab active:cursor-grabbing' : 'group border-b border-[var(--card-border)] transition hover:bg-slate-500/5 cursor-grab active:cursor-grabbing'}>
                <td className="py-2.5"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={selectedFileIds.has(file.id ?? '')} onChange={() => onToggleFile?.(file)} onClick={(event) => event.stopPropagation()} /></td>
                <td className="py-2.5 font-bold">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {mode === 'starred' ? <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" /> : <FileIcon kind={file.kind} />}
                    <span className="truncate max-w-[200px] lg:max-w-[280px] text-[var(--app-text)]" title={file.name}>{file.name}</span>
                  </span>
                </td>
                {/* Folder path column — only in default mode */}
                {mode === 'default' ? (
                  <td className="py-2.5 text-[var(--app-text-muted)]">
                    {file.folderName ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-blue-500">
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{file.folderName}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--app-text-muted)] opacity-60">—</span>
                    )}
                  </td>
                ) : null}
                {mode === 'shared' ? <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{file.owner}</td> : null}
                {mode === 'recent' ? <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{file.openedDate}</td> : null}
                {mode === 'starred' ? <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{file.starredDate}</td> : null}
                {mode === 'archived' ? <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{file.archivedDate}</td> : null}
                <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{mode === 'archived' ? file.location : file.date}</td>
                <td className="py-2.5 font-semibold text-[var(--app-text-muted)]">{file.size}</td>
                <td className="py-2.5 font-semibold text-[var(--app-text-muted)]"><span className="flex items-center gap-2"><AvatarStack count={file.shared} />{file.access}</span></td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Hover shortcuts */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1.5">
                      <button
                        title="Copy Link"
                        onClick={async (event) => {
                          event.stopPropagation()
                          try {
                            const data = await apiFetch<{ url: string | null }>(`/files/${file.id}/view-url`)
                            if (data.url) {
                              await navigator.clipboard.writeText(data.url)
                              setCopiedFileId(file.id ?? null)
                              setTimeout(() => setCopiedFileId(null), 2000)
                            } else {
                              const shareData = await apiFetch<{ url: string }>(`/files/${file.id}/share`, { method: 'POST' })
                              await navigator.clipboard.writeText(shareData.url)
                              setCopiedFileId(file.id ?? null)
                              setTimeout(() => setCopiedFileId(null), 2000)
                            }
                          } catch { /* ignore */ }
                        }}
                        className={
                          copiedFileId === file.id
                            ? "inline-flex h-7 px-2 items-center justify-center rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all scale-95"
                            : "inline-flex h-7 px-2 items-center justify-center rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 transition-colors"
                        }
                      >
                        {copiedFileId === file.id ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        title="Move File"
                        onClick={(event) => {
                          event.stopPropagation()
                          window.dispatchEvent(new CustomEvent('betterdrive:open-move-modal', { detail: file }))
                        }}
                        className="inline-flex h-7 px-2 items-center justify-center rounded-lg text-[11px] font-bold text-[var(--app-text)] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
                      >
                        Move
                      </button>
                    </div>
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 shrink-0" onClick={(event) => { event.stopPropagation(); onFileContextMenu?.(event, file) }} aria-label={`Open ${file.name} menu`}><MoreVertical className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
