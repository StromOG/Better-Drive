import { useState } from 'react'
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Info,
  KeyRound,
  Database,
  CloudUpload,
  Gauge,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  type NotificationCategory,
  type NotificationType,
} from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 30) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(dateString).toLocaleDateString()
  } catch {
    return 'Recent'
  }
}

function getCategoryIcon(category: NotificationCategory, type: NotificationType) {
  switch (category) {
    case 'upload':
      return <CloudUpload className="h-4 w-4 text-emerald-500" />
    case 'storage':
      return <Gauge className="h-4 w-4 text-amber-500" />
    case 'sftp':
      return <KeyRound className="h-4 w-4 text-cyan-500" />
    case 'backup':
      return <Database className="h-4 w-4 text-indigo-500" />
    case 'security':
      return <ShieldCheck className="h-4 w-4 text-purple-500" />
    case 'system':
    default:
      if (type === 'error') return <X className="h-4 w-4 text-rose-500" />
      return <Bell className="h-4 w-4 text-[var(--accent)]" />
  }
}

export function NotificationCenter({
  storage,
  onClose,
}: {
  storage: any
  onClose: () => void
}) {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState<'notifications' | 'workspace'>('notifications')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    return true
  })

  const activeGoogle =
    storage?.accounts?.filter(
      (a: any) => a.provider === 'google_drive' && a.status === 'connected'
    ) ?? []

  return (
    <div
      role="region"
      aria-label="Notification Center"
      className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] shadow-2xl shadow-black/30 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header with Tabs */}
      <div className="border-b border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-3">
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-[var(--app-text)]">
              Activity & Notifications
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-black text-white shadow-xs">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
              activeTab === 'notifications'
                ? 'bg-[var(--card-bg)] text-[var(--app-text)] shadow-sm'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            )}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts ({notifications.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
              activeTab === 'workspace'
                ? 'bg-[var(--card-bg)] text-[var(--app-text)] shadow-sm'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            )}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Workspace Status</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Notifications */}
      {activeTab === 'notifications' && (
        <div>
          {/* Subheader controls */}
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer',
                  filter === 'all'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={cn(
                  'font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer',
                  filter === 'unread'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                )}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--app-text-muted)]">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 hover:text-[var(--app-text)] hover:underline cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Read all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="flex items-center gap-1 text-rose-500 hover:text-rose-600 hover:underline cursor-pointer ml-1"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto overflow-x-hidden divide-y divide-[var(--card-border)]">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-[var(--accent)] mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="text-sm font-extrabold text-[var(--app-text)]">
                  {filter === 'unread' ? 'No unread alerts' : 'No notifications yet'}
                </p>
                <p className="text-xs text-[var(--app-text-muted)] mt-1 max-w-xs">
                  {filter === 'unread'
                    ? "You're all caught up! Check back when transfers or backups complete."
                    : 'File operations, sync alerts, and audit updates will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) markAsRead(notif.id)
                    if (notif.link) {
                      onClose()
                      navigate(notif.link)
                    }
                  }}
                  className={cn(
                    'group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer text-left',
                    notif.read
                      ? 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85'
                      : 'bg-[var(--accent)]/[0.04] hover:bg-[var(--accent)]/[0.08]'
                  )}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5">
                    {getCategoryIcon(notif.category, notif.type)}
                  </div>

                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'truncate text-xs text-[var(--app-text)]',
                          notif.read ? 'font-bold' : 'font-black'
                        )}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--app-text-muted)] line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--app-text-muted)] font-semibold">
                      <span>{formatRelativeTime(notif.timestamp)}</span>
                      {notif.link && (
                        <span className="flex items-center gap-1 text-[var(--accent)] font-bold group-hover:underline">
                          <span>{notif.actionLabel || 'View'}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeNotification(notif.id)
                    }}
                    className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Remove notification"
                    aria-label="Remove notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Workspace Status */}
      {activeTab === 'workspace' && (
        <div className="max-h-80 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-4">
          {/* Connection status */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Connection Status
            </h4>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-xs rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-2.5">
                <span className="font-semibold text-[var(--app-text)]">
                  Google Drive accounts
                </span>
                <span
                  className={
                    activeGoogle.length > 0
                      ? 'text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30'
                      : 'text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full font-bold border border-amber-500/30'
                  }
                >
                  {activeGoogle.length} Connected
                </span>
              </div>
              {activeGoogle.map((acc: any) => (
                <p
                  key={acc.id}
                  className="text-[11px] text-[var(--app-text-muted)] truncate px-2.5"
                >
                  — {acc.email}
                </p>
              ))}
            </div>
          </div>

          {/* Database & engine status */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-blue-500" /> Storage Engine & SFTP
            </h4>
            <div className="mt-2 text-xs text-[var(--app-text-muted)] space-y-1.5 bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-[var(--card-border)]">
              <p>
                • <b>Database:</b> SQLite (Local Database with WAL Checkpointing)
              </p>
              <p>
                • <b>Upload Folder:</b> Google Drive dedicated <code>BetterDrive</code>
              </p>
              <p>
                • <b>SFTP Gateway:</b> Key-only SSH service on port <code>2222</code>
              </p>
              <p>
                • <b>Max Upload Stream:</b> 5 GB per transfer
              </p>
            </div>
          </div>

          {/* Tips & Guides */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-indigo-500" /> Operational Tips
            </h4>
            <ul className="mt-2 text-[11px] text-[var(--app-text-muted)] list-disc list-inside space-y-1 pl-1">
              <li>Virtual folders exist securely in your SQLite database.</li>
              <li>Physical files stream straight to Google Drive & S3.</li>
              <li>Use Settings → Backup to create snapshot archives anytime.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
