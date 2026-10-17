import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileCode,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DummyModal } from '@/components/drive/DummyModal'
import { apiFetch, formatBytes, API_URL } from '@/lib/api'
import { getAccessToken, clearAuthSession } from '@/lib/auth'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

export function BackupRestoreCard() {
  const { notify } = useNotifications()
  const [backupFormat, setBackupFormat] = useState<'db' | 'json'>('db')
  const [backupStats, setBackupStats] = useState<{
    dbType: string
    sizeBytes: number
    formattedSize: string
    walSizeBytes: number
    walFormattedSize: string
    lastModified: string
    counts: {
      users: number
      files: number
      folders: number
      connectedAccounts: number
      sftpProfiles: number
      sftpKeys: number
      auditLogs: number
    }
    backupSafety: boolean
  } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [restoreSuccess, setRestoreSuccess] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [nineDriveGuideOpen, setNineDriveGuideOpen] = useState(false)

  async function fetchBackupStats() {
    setLoadingStats(true)
    try {
      const res = await apiFetch<any>('/system/backup/stats')
      if (res) {
        setBackupStats({
          dbType: res.dbType || res.databaseProvider || 'SQLite',
          sizeBytes: res.sizeBytes ?? res.databaseSizeBytes ?? 0,
          formattedSize: res.formattedSize || (res.databaseSizeBytes ? formatBytes(res.databaseSizeBytes) : '0 B'),
          walSizeBytes: res.walSizeBytes ?? 0,
          walFormattedSize: res.walFormattedSize || '0 B',
          lastModified: res.lastModified || new Date().toISOString(),
          counts: {
            users: res.counts?.users ?? 1,
            files: res.counts?.files ?? 0,
            folders: res.counts?.folders ?? 0,
            connectedAccounts: res.counts?.connectedAccounts ?? res.counts?.accounts ?? 0,
            sftpProfiles: res.counts?.sftpProfiles ?? 0,
            sftpKeys: res.counts?.sftpKeys ?? 0,
            auditLogs: res.counts?.auditLogs ?? 0,
          },
          backupSafety: res.backupSafety ?? true,
        })
      }
    } catch (e) {
      console.warn('Could not fetch backup stats', e)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    fetchBackupStats()
  }, [])

  async function downloadBackup() {
    setDownloadingBackup(true)
    try {
      const token = getAccessToken()
      const response = await fetch(`${API_URL}/system/backup?format=${backupFormat}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('Failed to retrieve database backup.')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
      a.download = `betterdrive-backup-${dateStr}.${backupFormat}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      notify.success(
        'Database Backup Downloaded',
        `Your ${backupFormat === 'db' ? 'SQLite binary' : 'Universal JSON'} backup has been safely saved.`,
        { category: 'backup' }
      )
    } catch (err: any) {
      notify.error('Backup Download Failed', err.message || 'Could not download backup file.', { category: 'backup' })
    } finally {
      setDownloadingBackup(false)
    }
  }

  function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setRestoreFile(e.target.files[0])
      setRestoreMessage('')
    }
  }

  function getBackupFileTypeLabel(name: string): string {
    if (name.endsWith('.sql')) return '9Drive SQL Database Dump'
    if (name.endsWith('.env') || name === '.env') return '9Drive .env Settings'
    if (name.endsWith('.json')) {
      return name.includes('9drive') ? '9Drive Universal JSON Archive' : 'Universal JSON Archive'
    }
    return 'Raw SQLite Database (.db)'
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const isSupported =
        file.name.endsWith('.db') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.sql') ||
        file.name.endsWith('.env') ||
        file.name === '.env'

      if (isSupported) {
        setRestoreFile(file)
        setRestoreMessage('')
      } else {
        notify.warning(
          'Invalid File Format',
          'Please upload a Better Drive (.db, .json) or 9Drive backup (.sql, .json, .env).',
          { category: 'backup' }
        )
      }
    }
  }

  async function executeRestore() {
    if (!restoreFile) return
    setRestoringBackup(true)
    setRestoreMessage('')
    setRestoreSuccess(false)
    setRestoreConfirmOpen(false)

    try {
      const token = getAccessToken()
      const formData = new FormData()
      formData.append('file', restoreFile)

      const response = await fetch(`${API_URL}/system/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to restore database.')
      }

      setRestoreSuccess(true)
      setRestoreMessage(data.message || 'Database restored successfully! Auto-rollback snapshot created. Reloading...')
      notify.success(
        'Database Restored Successfully',
        'Automatic rollback snapshot created. System logging out and reloading...',
        { category: 'backup', duration: 7000 }
      )

      setTimeout(() => {
        clearAuthSession()
        window.location.href = '/login'
      }, 3500)

    } catch (err: any) {
      setRestoreSuccess(false)
      const errMsg = err.message || 'Failed to restore database.'
      setRestoreMessage(errMsg)
      notify.error('Restore Failed', errMsg, { category: 'backup' })
    } finally {
      setRestoringBackup(false)
    }
  }

  return (
    <>
      <Card id="backup-restore-card" className="overflow-hidden p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-black text-[var(--app-text)]">Database Backup & Disaster Recovery</h2>
                <p className="text-[12px] font-medium text-[var(--app-text-muted)]">
                  Instant binary snapshots, portable JSON exports, and one-click database restoration.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setNineDriveGuideOpen(true)}
                className="text-xs font-bold gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Migrate from 9Drive</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={fetchBackupStats}
                disabled={loadingStats}
                className="text-xs font-bold gap-1.5 cursor-pointer"
                title="Refresh database metadata"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingStats && "animate-spin")} />
                <span>Refresh Stats</span>
              </Button>
            </div>
          </div>

          {/* Database Live Telemetry Badge Grid */}
          {backupStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">Database</span>
                <span className="text-sm font-black text-[var(--app-text)] truncate block mt-0.5">{backupStats.dbType}</span>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">Size on Disk</span>
                <span className="text-sm font-black text-[var(--app-text)] truncate block mt-0.5">{backupStats.formattedSize}</span>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">Indexed Files</span>
                <span className="text-sm font-black text-[var(--app-text)] truncate block mt-0.5">{backupStats.counts.files}</span>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">Connected Clouds</span>
                <span className="text-sm font-black text-[var(--app-text)] truncate block mt-0.5">{backupStats.counts.connectedAccounts}</span>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">SFTP Keys</span>
                <span className="text-sm font-black text-[var(--app-text)] truncate block mt-0.5">{backupStats.counts.sftpKeys}</span>
              </div>
              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] block">Safety State</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 truncate block mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Nominal
                </span>
              </div>
            </div>
          )}

          {/* Download & Restore Action Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Download Backup Section */}
            <div className="rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-300 p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-100">Download Database Backup</h3>
                    <p className="mt-1 text-[12px] text-emerald-900/80 dark:text-emerald-200/80 leading-normal font-medium">
                      Export complete snapshot of accounts, virtual folders, file metadata, SFTP keys, and configurations.
                    </p>
                  </div>
                </div>

                {/* Format Selector */}
                <div className="mt-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-300/70 mb-2">
                    Backup Format:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBackupFormat('db')}
                      className={cn(
                        "flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs",
                        backupFormat === 'db'
                          ? "border-emerald-600 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs"
                          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900/70 dark:text-emerald-300/70 hover:bg-emerald-500/10"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-black">
                        <Database className="h-3.5 w-3.5" />
                        <span>SQLite Binary (.db)</span>
                      </div>
                      <span className="text-[10px] opacity-80 mt-0.5">Raw bit-for-bit clone with WAL flush</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBackupFormat('json')}
                      className={cn(
                        "flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs",
                        backupFormat === 'json'
                          ? "border-emerald-600 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs"
                          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900/70 dark:text-emerald-300/70 hover:bg-emerald-500/10"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-black">
                        <FileCode className="h-3.5 w-3.5" />
                        <span>Universal JSON (.json)</span>
                      </div>
                      <span className="text-[10px] opacity-80 mt-0.5">Portable schema-safe data archive</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="mt-5 w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md shadow-emerald-500/15 border-0 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                onClick={downloadBackup}
                disabled={downloadingBackup}
              >
                <Download className={cn("h-4 w-4 text-white", downloadingBackup && "animate-bounce")} />
                <span className="text-white font-bold">
                  {downloadingBackup ? 'Preparing Snapshot...' : `Download ${backupFormat === 'db' ? 'SQLite Database' : 'Universal Archive'}`}
                </span>
              </button>
            </div>

            {/* Restore Backup Section */}
            <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300 p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group">
              <div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">Restore Database Backup</h3>
                    <p className="mt-1 text-[12px] text-amber-900/80 dark:text-amber-200/80 leading-normal font-medium">
                      Upload Better Drive (.db, .json) or 9Drive (.sql, .json, .env). Automatic rollback safety snapshot is taken before write.
                    </p>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  className={cn(
                    "mt-4 rounded-xl border-2 border-dashed transition-all p-3.5 text-center flex flex-col items-center justify-center min-h-[96px]",
                    isDragOver
                      ? "border-amber-500 bg-amber-500/20 scale-[1.01]"
                      : restoreFile
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                  )}
                >
                  {restoreFile ? (
                    <div className="flex w-full items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          {restoreFile.name.endsWith('.json') ? <FileCode className="h-4 w-4" /> : <FileArchive className="h-4 w-4" />}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="truncate text-xs font-bold text-amber-950 dark:text-amber-100 max-w-[200px]" title={restoreFile.name}>
                            {restoreFile.name}
                          </p>
                          <span className="text-[11px] font-semibold text-amber-900/70 dark:text-amber-300/70">
                            {formatBytes(restoreFile.size)} · {getBackupFileTypeLabel(restoreFile.name)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRestoreFile(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 transition"
                        title="Remove selected file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer w-full">
                      <UploadCloud className="h-6 w-6 text-amber-600 dark:text-amber-400 mb-1" />
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
                        Drop backup file here or <span className="underline decoration-amber-500">browse</span>
                      </span>
                      <span className="text-[10px] text-amber-900/70 dark:text-amber-300/70 mt-0.5">
                        Supports Better Drive (.db, .json) & 9Drive (.sql, .json, .env)
                      </span>
                      <input
                        type="file"
                        accept=".db,.json,.sql,.env"
                        onChange={handleRestoreFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="mt-4">
                {restoreFile ? (
                  <button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-md shadow-amber-500/15 border-0 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => {
                      setRestoreConfirmed(false)
                      setRestoreConfirmOpen(true)
                    }}
                    disabled={restoringBackup}
                  >
                    <RefreshCw className={cn("h-4 w-4 text-white", restoringBackup && "animate-spin")} />
                    <span className="text-white font-bold">
                      {restoringBackup ? 'Restoring & Restarting...' : 'Review & Restore Database'}
                    </span>
                  </button>
                ) : (
                  <button
                    className="w-full h-11 rounded-xl bg-slate-500/10 text-[var(--app-text-muted)] border border-[var(--card-border)] cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-xs"
                    disabled
                  >
                    <RefreshCw className="h-4 w-4 text-[var(--app-text-muted)]" />
                    <span>Select Backup to Restore</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {restoreMessage && (
            <div className={cn(
              "rounded-xl p-3.5 text-xs font-bold flex items-start gap-2.5",
              restoreSuccess
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                : "bg-red-500/15 border border-red-500/30 text-red-800 dark:text-red-200"
            )}>
              {restoreSuccess ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />}
              <span>{restoreMessage}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Safety Confirmation Modal for Database Restore */}
      <DummyModal
        open={restoreConfirmOpen}
        title="Confirm Database Restore"
        description="Review this critical operation carefully before writing changes."
        onClose={() => setRestoreConfirmOpen(false)}
      >
        <div className="grid gap-4">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-900 dark:text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm">Critical Warning</p>
                <p className="mt-1 leading-relaxed">
                  Restoring this database will overwrite all active user accounts, virtual folder hierarchies, file metadata, and SFTP access profiles. The backend will automatically reload.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-100">
            <div className="flex items-center gap-2 font-black">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Automated Rollback Safety Snapshot</span>
            </div>
            <p className="mt-1 leading-normal text-emerald-900/80 dark:text-emerald-200/80 text-[11px]">
              Better Drive automatically generates a pre-restore backup in <code className="bg-emerald-500/20 px-1 py-0.5 rounded font-mono">data/backups/rollback-...</code> before touching any active records.
            </p>
          </div>

          {restoreFile && (
            <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-3 text-xs">
              <p className="font-extrabold text-[var(--app-text)]">Selected Backup File:</p>
              <p className="font-mono mt-0.5 text-[var(--app-text-muted)] truncate">{restoreFile.name}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-[var(--app-text)]">
                <span>Size: {formatBytes(restoreFile.size)}</span>
                <span>Type: {getBackupFileTypeLabel(restoreFile.name)}</span>
              </div>
              {(restoreFile.name.endsWith('.sql') || restoreFile.name.endsWith('.env') || restoreFile.name === '.env' || restoreFile.name.includes('9drive')) && (
                <div className="mt-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 p-2.5 text-[11px] text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                  <strong>9Drive Backup Source Detected:</strong> Better Drive will automatically parse your 9Drive settings, Google OAuth credentials, users, virtual folders, and file records into the new hardened schema.
                </div>
              )}
            </div>
          )}

          <label className="flex items-start gap-2.5 text-xs font-semibold text-[var(--app-text)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={restoreConfirmed}
              onChange={(e) => setRestoreConfirmed(e.target.checked)}
              className="mt-0.5 rounded accent-[var(--accent)]"
            />
            <span>I understand that current database tables will be overwritten by this backup.</span>
          </label>

          <div className="grid gap-3 sm:flex sm:justify-end mt-1">
            <Button
              variant="outline"
              type="button"
              onClick={() => setRestoreConfirmOpen(false)}
              disabled={restoringBackup}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={executeRestore}
              disabled={!restoreConfirmed || restoringBackup}
            >
              <RefreshCw className={cn("h-4 w-4", restoringBackup && "animate-spin")} />
              <span>{restoringBackup ? 'Restoring & Restarting...' : 'Confirm & Restore Database'}</span>
            </Button>
          </div>
        </div>
      </DummyModal>

      {/* 9Drive Migration & Backup Guide Modal */}
      <DummyModal
        open={nineDriveGuideOpen}
        title="Migrate from 9Drive"
        description="Transfer your Google Drive storage accounts, folder trees, file records, and OAuth credentials directly into Better Drive."
        onClose={() => setNineDriveGuideOpen(false)}
        className="sm:max-w-xl"
      >
        <div className="grid gap-4 text-xs">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-amber-950 dark:text-amber-100">
                  Universal 9Drive Compatibility
                </h4>
                <p className="mt-1 text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                  Better Drive natively parses 9Drive exports. You can import your entire system in one step without manual database re-indexing.
                </p>
              </div>
            </div>
          </div>

          {/* Option A: Automatic Exporter Tool */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">1</span>
              <span>Option A: One-Click 9Drive Exporter</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-extrabold">Recommended</span>
            </div>
            <p className="text-[var(--app-text-muted)] leading-relaxed">
              Run this command inside your terminal. It scans your 9Drive folder, extracts Google OAuth credentials from <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">.env</code>, extracts SQL database records, and generates a ready-to-restore archive:
            </p>
            <div className="rounded-xl border border-slate-800 bg-[#090d16] p-3 text-emerald-400 font-mono text-[11px] select-all shadow-inner">
              npm run backup:9drive
            </div>
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Output: <strong className="text-[var(--app-text)] font-mono">better-drive-archive-from-9drive.json</strong>
            </p>
          </div>

          {/* Option B: Direct SQL Dump */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">2</span>
              <span>Option B: Drop your 9Drive MySQL .sql Dump</span>
            </div>
            <p className="text-[var(--app-text-muted)] leading-relaxed">
              If you exported your 9Drive database using <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">mysqldump</code>, phpMyAdmin, or TablePlus, you can drop the raw <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">.sql</code> file directly into the Restore zone!
            </p>
          </div>
        </div>
      </DummyModal>
    </>
  )
}
