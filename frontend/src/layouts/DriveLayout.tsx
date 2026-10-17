import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Outlet, useOutletContext, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  Braces,
  FileArchive,
  Gauge,
  History,
  LogOut,
  Menu,
  Moon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  X,
  CheckCircle,
  ChevronDown,
  Upload,
  Keyboard,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/drive/BrandLogo'
import { Input } from '@/components/ui/input'
import { CustomSelect } from '@/components/ui/select'
import { apiFetch, formatBytes } from '@/lib/api'
import { useUpload } from '@/context/UploadContext'
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth'
import { getGravatarUrl } from '@/lib/gravatar'
import { cn } from '@/lib/utils'
import { DashboardMascot, useMascot } from '@/components/mascot'
import { useTheme } from '@/lib/theme'
import { ShortcutsModal } from '@/components/drive/ShortcutsModal'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { ToastContainer } from '@/components/notifications/ToastContainer'
import { useNotifications } from '@/context/NotificationContext'

const menu = [
  { label: 'All Files', icon: FileArchive, href: '/all-files' },
  { label: 'Quota Tracker', icon: Gauge, href: '/quota' },
  { label: 'Termius / SFTP', icon: Terminal, href: '/termius' },
  { label: 'Shared With Me', icon: Share2, href: '/shared' },
  { label: 'Starred', icon: Star, href: '/starred', disabled: true },
  { label: 'Recycle Bin', icon: Trash2, href: '/trash' },
  { label: 'Activity Logs', icon: History, href: '/activity' },
  { label: 'Settings', icon: Settings, href: '/settings' },
  { label: 'API Keys', icon: Braces, href: '/api' },
]

type StorageSummary = {
  totalBytes: string
  usedBytes: string
  availableBytes: string
}

type StorageBreakdown = {
  photo: string
  video: string
  document: string
}

function Sidebar({
  onNavigate,
  user,
  storage,
  breakdown,
  onLogout,
  onOpenShortcuts,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void
  user: AuthUser | null
  storage: StorageSummary | null
  breakdown: StorageBreakdown
  onLogout: () => void
  onOpenShortcuts?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const used = Number(storage?.usedBytes ?? 0)
  const total = Number(storage?.totalBytes ?? 0)
  const progress = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const [profileImageUrl, setProfileImageUrl] = useState(() => user?.avatarUrl || getStoredUser()?.avatarUrl || '')
  const [avatarError, setAvatarError] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const items = [
    ['Photo', formatBytes(breakdown.photo), 'bg-lime-500'],
    ['Video', formatBytes(breakdown.video), 'bg-yellow-400'],
    ['Document', formatBytes(breakdown.document), 'bg-cyan-400'],
    ['Free Storage', formatBytes(storage?.availableBytes), 'bg-orange-500'],
  ]

  useEffect(() => {
    if (!profileMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    setAvatarError(false)
    if (user?.avatarUrl) {
      setProfileImageUrl(user.avatarUrl)
      return
    }
    const email = user?.email
    if (!email) return
    getGravatarUrl(email, 64).then((url) => {
      if (url) setProfileImageUrl(url)
    }).catch(() => setProfileImageUrl(''))
  }, [user?.email, user?.avatarUrl])

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] lg:border-r text-[var(--app-text)] overflow-hidden select-none px-3 py-3.5"
      )}
    >
      {/* Brand Header */}
      <div className={cn("flex items-center h-10 w-full shrink-0 transition-all duration-200", collapsed ? "justify-center px-0" : "px-3 gap-3")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <BrandLogo className="h-8 w-8 shrink-0" />
        </div>
        <span
          className={cn(
            "text-xl font-extrabold tracking-tight bg-gradient-to-r from-[var(--app-text)] to-[var(--accent)] bg-clip-text text-transparent truncate whitespace-nowrap transition-all duration-200 leading-tight",
            collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
          )}
        >
          Better Drive
        </span>
      </div>

      {/* Collapse Sidebar Button - Aligned with Nav Items, follows exact same slide animation pattern */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "flex h-10 items-center rounded-xl text-[13px] font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer w-full overflow-hidden mt-1",
            collapsed ? "justify-center px-0" : "px-3 gap-3"
          )}
          title={collapsed ? "Expand sidebar (Ctrl+[)" : "Collapse sidebar (Ctrl+[)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5 shrink-0 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" />
            ) : (
              <PanelLeftClose className="h-5 w-5 shrink-0 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" />
            )}
          </div>
          <span
            className={cn(
              "truncate whitespace-nowrap transition-all duration-200 leading-normal py-0.5 text-xs font-bold flex-1 text-left flex items-center justify-between",
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
            )}
          >
            <span>Collapse Sidebar</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--sidebar-border)] bg-black/5 dark:bg-white/5 font-semibold text-[var(--app-text-muted)]">Ctrl+[</kbd>
          </span>
        </button>
      )}

      {/* User Profile Card */}
      <div
        className={cn(
          "relative flex items-center border-y border-[var(--sidebar-border)] py-3 my-2.5 w-full shrink-0 transition-all duration-200",
          collapsed ? "justify-center px-0" : "gap-3 px-3"
        )}
        ref={profileMenuRef}
      >
        <button
          type="button"
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={cn(
            "rounded-full transition-transform active:scale-95 focus:outline-none cursor-pointer shrink-0",
            collapsed && "hover:ring-2 hover:ring-[var(--accent)]/50"
          )}
          title={collapsed ? (user?.name || user?.email || 'User Account') : undefined}
          aria-label="User account menu"
        >
          {!profileImageUrl || avatarError ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white shadow-sm border border-[var(--accent)]/30">
              {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
            </div>
          ) : (
            <img
              src={profileImageUrl}
              alt="User avatar"
              className="h-8 w-8 rounded-full border border-[var(--sidebar-border)] object-cover shrink-0"
              onError={() => setAvatarError(true)}
            />
          )}
        </button>

        <div
          className={cn(
            "min-w-0 flex-1 flex items-center justify-between overflow-hidden transition-all duration-200",
            collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[280px]"
          )}
        >
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-[15px] font-extrabold text-[var(--app-text)] leading-tight whitespace-nowrap">{user?.name ?? 'User'}</p>
            <p className="truncate text-xs font-semibold text-[var(--app-text-muted)] mt-0.5 whitespace-nowrap leading-tight">{user?.email ?? 'Loading...'}</p>
          </div>
          <button
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
              profileMenuOpen && "bg-black/5 dark:bg-white/10 text-[var(--app-text)] ring-1 ring-[var(--card-border)]"
            )}
            aria-label="User account menu"
            aria-expanded={profileMenuOpen}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Dropdown Menu */}
        {profileMenuOpen && (
          <div
            className={cn(
              "absolute z-50 w-56 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150",
              collapsed ? "left-full top-0 ml-3" : "right-0 top-full mt-1"
            )}
          >
            <div className="px-3 py-2 border-b border-[var(--card-border)] mb-1">
              <p className="text-xs font-extrabold truncate text-[var(--app-text)]">{user?.name ?? 'Account'}</p>
              <p className="text-[11px] font-semibold truncate text-[var(--app-text-muted)]">{user?.email ?? ''}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false)
                onNavigate?.()
                navigate('/settings')
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <Settings className="h-4 w-4 text-[var(--accent)]" />
              <span>Account Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false)
                onNavigate?.()
                navigate('/quota')
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <Gauge className="h-4 w-4 text-emerald-500" />
              <span>Storage Quota</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false)
                onOpenShortcuts?.()
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className="h-4 w-4 text-[var(--accent)]" />
                <span>Shortcuts & Keybinds</span>
              </div>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--card-border)] bg-[var(--app-bg)] font-bold text-[var(--app-text-muted)]">?</kbd>
            </button>

            <div className="my-1 border-t border-[var(--card-border)]" />

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false)
                onLogout()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links — Clean Viewport Fitting Without Inner Scrolling */}
      <nav className="flex-1 grid gap-1 w-full my-1 select-none">
        {menu.map((item) => item.disabled ? (
          <button
            key={item.label}
            type="button"
            disabled
            title={item.label}
            className={cn(
              "flex h-9 items-center rounded-xl text-[13px] font-bold text-slate-400 opacity-50 cursor-not-allowed overflow-hidden w-full transition-colors",
              collapsed ? "justify-center px-0" : "px-3 gap-3"
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <item.icon className="h-4 w-4 shrink-0" />
            </div>
            <span
              className={cn(
                "truncate whitespace-nowrap transition-all duration-200 leading-normal py-0.5",
                collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
              )}
            >
              {item.label}
            </span>
          </button>
        ) : (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            data-tour={
              item.href === '/settings'
                ? 'settings'
                : item.href === '/termius'
                ? 'termius'
                : item.href === '/all-files'
                ? 'all-files'
                : undefined
            }
            className={({ isActive }) => cn(
              'flex h-9 items-center rounded-xl text-[13px] font-bold border border-transparent transition-all duration-150 overflow-hidden w-full outline-none focus:outline-none',
              collapsed ? 'justify-center px-0' : 'px-3 gap-3',
              (isActive ||
                (item.href === '/settings' && location.pathname.startsWith('/settings')) ||
                (item.href === '/api' && (location.pathname.startsWith('/api') || location.pathname.startsWith('/settings/api-keys'))))
                ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/20 shadow-xs font-black'
                : 'text-[var(--app-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--app-text)]'
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <item.icon className="h-4 w-4 shrink-0" />
            </div>
            <span
              className={cn(
                "truncate whitespace-nowrap transition-all duration-200 leading-normal py-0.5",
                collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
              )}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Quota / Footer - Stays pinned at bottom, never cut off */}
      <div
        data-tour="quota"
        className="mt-auto shrink-0 border-t border-[var(--sidebar-border)] text-[13px] w-full pt-2.5 pb-1"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1 animate-in fade-in duration-200">
            <NavLink
              to="/settings/accounts"
              title={`Storage: ${formatBytes(storage?.usedBytes) === '--' ? '0 B' : formatBytes(storage?.usedBytes)} / ${formatBytes(storage?.totalBytes) === '--' ? '0 B' : formatBytes(storage?.totalBytes)} (${Math.round(progress)}%)`}
              className="flex h-10 w-10 flex-col items-center justify-center rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--accent)] transition-colors p-1"
            >
              <Gauge className="h-4 w-4 shrink-0" />
              <div className="w-7 h-1.5 rounded-full bg-black/15 dark:bg-white/20 border border-black/10 dark:border-white/25 overflow-hidden mt-1 shadow-inner">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", progress > 0 ? "bg-[var(--accent)]" : "bg-transparent")}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </NavLink>
            <button
              type="button"
              onClick={onLogout}
              title="Log Out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-200 overflow-hidden">
            <NavLink
              to="/settings/accounts"
              className="block group rounded-2xl p-2.5 -mx-1 transition-all hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-[var(--card-border)] cursor-pointer"
            >
              <div className="space-y-1.5">
                {items.map(([label, value, color]) => (
                  <div key={label} className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-[var(--app-text-muted)] truncate whitespace-nowrap">
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', color)} />
                      {label}
                    </span>
                    <span className="font-extrabold text-[var(--app-text)] shrink-0 pl-1">
                      {value === '--' ? '0 B' : value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-extrabold text-[var(--app-text)] mt-2.5">
                <span className="truncate whitespace-nowrap leading-normal">
                  {formatBytes(storage?.usedBytes) === '--' ? '0 B' : formatBytes(storage?.usedBytes)} used
                </span>
                <span className="text-[var(--app-text-muted)] font-bold text-xs shrink-0">
                  {total > 0
                    ? `${formatBytes(storage?.totalBytes)} (${Math.round(progress)}%)`
                    : '0 B (0%)'}
                </span>
              </div>
              <div
                className="relative h-2.5 w-full rounded-full bg-black/15 dark:bg-white/20 border border-black/15 dark:border-white/25 shadow-inner overflow-hidden mt-1.5"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    progress > 0
                      ? "bg-gradient-to-r from-[var(--accent)] via-teal-500 to-emerald-400 shadow-xs"
                      : "bg-transparent"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </NavLink>
            <Button variant="danger" size="sm" className="w-full justify-start h-9 px-3 text-[13px] font-bold" onClick={onLogout}>
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate whitespace-nowrap leading-normal py-0.5">Log Out</span>
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}

type ConnectedAccount = {
  id: string
  email: string
  provider: string
}

export type DriveLayoutContext = {
  setHeaderActions: (actions: ReactNode) => void
}

export function useDriveLayoutActions() {
  return useOutletContext<DriveLayoutContext>()
}

export function DriveLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notify, unreadCount } = useNotifications()
  const { setPosition } = useMascot()

  const [searchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '')
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())
  const [storage, setStorage] = useState<StorageSummary | null>(null)
  const [breakdown, setBreakdown] = useState<StorageBreakdown>({ photo: '0', video: '0', document: '0' })
  const [infoOpen, setInfoOpen] = useState(false)
  const [headerActions, setHeaderActions] = useState<ReactNode>(null)
  const { uploadProgress, setUploadProgress, retryFailedUpload } = useUpload()
  const [uploadProgressCollapsed, setUploadProgressCollapsed] = useState(false)

  // Floating avoidance: when upload progress card is open, float Byte above it gracefully
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__betterdrive_set_upload_progress = setUploadProgress
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as Record<string, unknown>).__betterdrive_set_upload_progress
      }
    }
  }, [setUploadProgress])

  useEffect(() => {
    if (uploadProgress.open && !uploadProgressCollapsed) {
      if (typeof window !== 'undefined') {
        const targetY = Math.max(60, window.innerHeight - 510)
        const targetX = Math.max(20, window.innerWidth - 145)
        setPosition({ x: targetX, y: targetY })
      }
    }
  }, [uploadProgress.open, uploadProgressCollapsed, setPosition])

  const prevUploadStatusRef = useRef(uploadProgress.status)
  useEffect(() => {
    if (uploadProgress.status === 'done' && prevUploadStatusRef.current !== 'done') {
      notify.success('Upload Completed', `${uploadProgress.fileName || 'Files'} uploaded and encrypted.`, {
        category: 'upload',
        link: '/all-files',
        actionLabel: 'View Vault',
      })
    } else if (uploadProgress.status === 'error' && prevUploadStatusRef.current !== 'error') {
      notify.error('Upload Failed', `Could not finish upload for ${uploadProgress.fileName || 'file'}.`, {
        category: 'upload',
      })
    }
    prevUploadStatusRef.current = uploadProgress.status
  }, [uploadProgress.status, uploadProgress.fileName, notify])
  const { isDarkMode, toggleMode } = useTheme()
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterKind, setFilterKind] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')
  const [filterMinSize, setFilterMinSize] = useState('')
  const [filterMaxSize, setFilterMaxSize] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const sidebarContainerRef = useRef<HTMLDivElement>(null)

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('betterdrive:sidebar-width')
    const num = saved ? Number(saved) : 260
    return isNaN(num) || num < 200 || num > 440 ? 260 : num
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('betterdrive:sidebar-collapsed') === 'true'
  })
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const isDraggingRef = useRef(false)
  const isCollapsedRef = useRef(isSidebarCollapsed)
  const currentWidthRef = useRef(sidebarWidth)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    isCollapsedRef.current = isSidebarCollapsed
  }, [isSidebarCollapsed])

  useEffect(() => {
    currentWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    setIsDraggingSidebar(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let isCurrentlySnapped = isCollapsedRef.current
    let targetWidth = isCurrentlySnapped ? 72 : currentWidthRef.current

    if (sidebarContainerRef.current) {
      sidebarContainerRef.current.style.transition = 'none'
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return

      const rawX = moveEvent.clientX

      // Magnetic snap physics:
      // Inward collapse snap threshold: rawX < 145px
      // Outward expand snap threshold: rawX > 165px (20px hysteresis prevents flutter)
      if (rawX < 145) {
        if (!isCurrentlySnapped) {
          isCurrentlySnapped = true
          setIsSidebarCollapsed(true)
          if (sidebarContainerRef.current) {
            sidebarContainerRef.current.style.transition = 'width 180ms cubic-bezier(0.16, 1, 0.3, 1)'
            sidebarContainerRef.current.style.width = '72px'
          }
        }
      } else if (rawX > 165) {
        const expandedW = Math.max(200, Math.min(440, rawX))
        if (isCurrentlySnapped) {
          isCurrentlySnapped = false
          setIsSidebarCollapsed(false)
          targetWidth = expandedW
          if (sidebarContainerRef.current) {
            sidebarContainerRef.current.style.transition = 'width 180ms cubic-bezier(0.16, 1, 0.3, 1)'
            sidebarContainerRef.current.style.width = `${expandedW}px`
          }
        } else {
          targetWidth = expandedW
          if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = requestAnimationFrame(() => {
            if (sidebarContainerRef.current && isDraggingRef.current && !isCurrentlySnapped) {
              sidebarContainerRef.current.style.transition = 'none'
              sidebarContainerRef.current.style.width = `${targetWidth}px`
            }
          })
        }
      }
    }

    const onMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDraggingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      if (sidebarContainerRef.current) {
        sidebarContainerRef.current.style.transition = 'width 240ms cubic-bezier(0.16, 1, 0.3, 1)'
      }

      if (isCurrentlySnapped) {
        setIsSidebarCollapsed(true)
        localStorage.setItem('betterdrive:sidebar-collapsed', 'true')
        if (sidebarContainerRef.current) {
          sidebarContainerRef.current.style.width = '72px'
        }
      } else {
        const finalWidth = Math.max(200, Math.min(440, Math.round(targetWidth)))
        setIsSidebarCollapsed(false)
        setSidebarWidth(finalWidth)
        localStorage.setItem('betterdrive:sidebar-collapsed', 'false')
        localStorage.setItem('betterdrive:sidebar-width', String(finalWidth))
        if (sidebarContainerRef.current) {
          sidebarContainerRef.current.style.width = `${finalWidth}px`
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    if (!filtersOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[aria-label="Search filters"]')
      ) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filtersOpen])

  async function loadSidebarStats() {
    await Promise.all([
      apiFetch<StorageSummary>('/storage/summary').then(setStorage),
      apiFetch<StorageBreakdown>('/storage/breakdown').then(setBreakdown),
    ])
  }

  async function loadConnectedAccounts() {
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts')
      setAccounts(data.accounts)
    } catch (e) {
      console.error('Failed to load accounts for filter dropdown', e)
    }
  }

  useEffect(() => {
    function handleUserUpdated(e: Event) {
      const customEvent = e as CustomEvent<AuthUser>
      if (customEvent.detail) {
        setUser(customEvent.detail)
      } else {
        setUser(getStoredUser())
      }
    }
    window.addEventListener('betterdrive:user-updated', handleUserUpdated)
    return () => window.removeEventListener('betterdrive:user-updated', handleUserUpdated)
  }, [])

  useEffect(() => {
    setSearchValue(searchParams.get('q') ?? '')
    setFilterKind(searchParams.get('kind') ?? '')
    setFilterAccountId(searchParams.get('accountId') ?? '')
    setFilterMinSize(() => {
      const min = searchParams.get('minSize')
      return min ? String(Math.round(Number(min) / (1024 * 1024))) : ''
    })
    setFilterMaxSize(() => {
      const max = searchParams.get('maxSize')
      return max ? String(Math.round(Number(max) / (1024 * 1024))) : ''
    })

    const rawStart = searchParams.get('startDate')
    setFilterStartDate(rawStart ? rawStart.split('T')[0] : '')

    const rawEnd = searchParams.get('endDate')
    setFilterEndDate(rawEnd ? rawEnd.split('T')[0] : '')
  }, [searchParams])

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined)
    clearAuthSession()
    navigate('/login')
  }

  function applyFilters() {
    const nextParams = new URLSearchParams()
    const activeFolderId = searchParams.get('folderId')
    if (activeFolderId && location.pathname === '/all-files') {
      nextParams.set('folderId', activeFolderId)
    }

    const q = searchValue.trim()
    if (q) nextParams.set('q', q)

    if (filterKind) nextParams.set('kind', filterKind)
    if (filterAccountId) nextParams.set('accountId', filterAccountId)

    if (filterMinSize) {
      const bytes = Number(filterMinSize) * 1024 * 1024
      if (!isNaN(bytes)) nextParams.set('minSize', String(bytes))
    }
    if (filterMaxSize) {
      const bytes = Number(filterMaxSize) * 1024 * 1024
      if (!isNaN(bytes)) nextParams.set('maxSize', String(bytes))
    }

    if (filterStartDate) {
      nextParams.set('startDate', new Date(filterStartDate).toISOString())
    }
    if (filterEndDate) {
      nextParams.set('endDate', new Date(filterEndDate).toISOString())
    }

    setFiltersOpen(false)
    navigate({ pathname: '/all-files', search: nextParams.toString() })
  }

  function clearFilters() {
    setFilterKind('')
    setFilterAccountId('')
    setFilterMinSize('')
    setFilterMaxSize('')
    setFilterStartDate('')
    setFilterEndDate('')
    setFiltersOpen(false)

    const nextParams = new URLSearchParams()
    const activeFolderId = searchParams.get('folderId')
    if (activeFolderId && location.pathname === '/all-files') {
      nextParams.set('folderId', activeFolderId)
    }
    const q = searchValue.trim()
    if (q) nextParams.set('q', q)

    navigate({ pathname: '/all-files', search: nextParams.toString() })
  }

  function searchFiles(event: FormEvent) {
    event.preventDefault()
    applyFilters()
  }

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((data) => {
        setUser(data.user)
        updateStoredUser(data.user)
      })
      .catch(() => undefined)
    loadSidebarStats().catch(() => undefined)
    loadConnectedAccounts().catch(() => undefined)
    window.addEventListener('betterdrive:storage-changed', loadSidebarStats)
    return () => window.removeEventListener('betterdrive:storage-changed', loadSidebarStats)
  }, [])

  const searchInputRef = useRef<HTMLInputElement>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const chordRef = useRef<string | null>(null)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const activeEl = document.activeElement
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)

      // Key: Ctrl+[ or Cmd+[ toggles sidebar collapse
      if ((event.ctrlKey || event.metaKey) && event.key === '[') {
        event.preventDefault()
        setIsSidebarCollapsed((prev) => {
          const next = !prev
          localStorage.setItem('betterdrive:sidebar-collapsed', String(next))
          return next
        })
        return
      }

      // Key: ? (Shift + /) opens Keyboard Shortcuts sheet
      if (event.key === '?' && !isInputActive) {
        event.preventDefault()
        setShortcutsOpen((prev) => !prev)
        return
      }

      // Key: / or Ctrl+K / Cmd+K jumps to search bar
      if (
        (event.key === '/' && !isInputActive) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      // Key: \ toggles light / dark theme
      if (event.key === '\\' && !isInputActive && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        toggleMode()
        return
      }

      // Two-key chord navigation (press 'g' then destination key)
      if (!isInputActive && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key.toLowerCase() === 'g' && chordRef.current !== 'g') {
          chordRef.current = 'g'
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
          chordTimerRef.current = setTimeout(() => {
            chordRef.current = null
          }, 1500)
          return
        }

        if (chordRef.current === 'g') {
          chordRef.current = null
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
          const targetKey = event.key.toLowerCase()
          switch (targetKey) {
            case 'h':
              event.preventDefault()
              navigate('/')
              return
            case 'f':
              event.preventDefault()
              navigate('/all-files')
              return
            case 's':
              event.preventDefault()
              navigate('/starred')
              return
            case 'r':
              event.preventDefault()
              navigate('/recent')
              return
            case 't':
              event.preventDefault()
              navigate('/trash')
              return
            case 'k':
              event.preventDefault()
              navigate('/api')
              return
            case 'p':
              event.preventDefault()
              navigate('/settings/profile')
              return
            case 'a':
              event.preventDefault()
              navigate('/settings/accounts')
              return
            case 'm':
              event.preventDefault()
              navigate('/settings/members')
              return
            case 'n':
              event.preventDefault()
              navigate('/settings/notifications')
              return
            case 'q':
              event.preventDefault()
              navigate('/quota')
              return
          }
        }
      }

      // Key: Escape closes modals or blurs search
      if (event.key === 'Escape') {
        setInfoOpen(false)
        setFiltersOpen(false)
        setShortcutsOpen(false)
        if (activeEl === searchInputRef.current) {
          searchInputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMode, navigate])

  return (
    <main className="min-h-screen w-full overflow-x-hidden app-canvas text-[var(--app-text)]">
      <div className="flex min-h-screen w-full flex-col bg-transparent lg:h-screen lg:overflow-hidden lg:flex-row">
        {/* Desktop Collapsible & Draggable-Resizable Sidebar */}
        <div
          ref={sidebarContainerRef}
          className="hidden lg:block lg:h-screen lg:shrink-0 relative group select-none"
          style={{
            width: isSidebarCollapsed ? 72 : sidebarWidth,
            transition: isDraggingSidebar ? 'none' : 'width 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: isDraggingSidebar ? 'width' : 'auto',
          }}
        >
          <Sidebar
            user={user}
            storage={storage}
            breakdown={breakdown}
            onLogout={logout}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            collapsed={isSidebarCollapsed}
            onToggleCollapse={() => {
              setIsSidebarCollapsed((prev) => {
                const next = !prev
                localStorage.setItem('betterdrive:sidebar-collapsed', String(next))
                return next
              })
            }}
          />
          {/* Drag Resize Handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize sidebar • Double-click to collapse/expand"
            onMouseDown={startSidebarResize}
            onDoubleClick={() => {
              setIsSidebarCollapsed((prev) => {
                const next = !prev
                localStorage.setItem('betterdrive:sidebar-collapsed', String(next))
                return next
              })
            }}
            className={cn(
              "absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-30 flex items-center justify-center transition-colors select-none",
              isDraggingSidebar ? "bg-[var(--accent)]/30" : "hover:bg-[var(--accent)]/15"
            )}
          >
            <div
              className={cn(
                "w-1 rounded-full transition-all duration-200",
                isDraggingSidebar
                  ? "h-full bg-[var(--accent)] shadow-sm shadow-[var(--accent)]/50"
                  : "h-8 bg-transparent group-hover:bg-[var(--app-text-muted)]/50 group-hover:h-16"
              )}
            />
          </div>
        </div>

        <div className={cn('fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden', sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setSidebarOpen(false)} />
        <div className={cn('fixed inset-y-0 left-0 z-50 transform bg-[var(--sidebar-bg)] text-[var(--app-text)] border-r border-[var(--sidebar-border)] shadow-2xl transition-transform duration-300 ease-out lg:hidden', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="absolute right-4 top-4 z-10">
            <Button variant="outline" size="icon" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Sidebar
            user={user}
            storage={storage}
            breakdown={breakdown}
            onLogout={logout}
            onNavigate={() => setSidebarOpen(false)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        </div>
        <section className="min-w-0 flex-1 p-4 sm:p-6 lg:h-screen lg:overflow-y-auto lg:p-8">
          <header className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="outline" size="icon" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex min-w-0 items-center gap-2">
                  <BrandLogo className="h-9 w-9 shrink-0" />
                  <span className="truncate text-xl font-extrabold tracking-tight">Better Drive</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={toggleMode} className="border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)]">
                  {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
                </Button>
                <div className="relative shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative cursor-pointer"
                    aria-label="Notification center"
                    aria-expanded={infoOpen}
                    onClick={() => setInfoOpen(!infoOpen)}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-75">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                  {infoOpen ? <NotificationCenter storage={storage} onClose={() => setInfoOpen(false)} /> : null}
                </div>
              </div>
            </div>
            <div data-tour="search" className="relative w-full min-w-0 flex-1 lg:max-w-sm xl:max-w-xl">
              <form onSubmit={searchFiles} className="relative w-full">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={searchInputRef}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search Documents..."
                  className="pl-11 pr-24"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <div className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono font-bold text-[var(--app-text-muted)] bg-black/5 dark:bg-white/10 border border-[var(--card-border)] px-1.5 py-0.5 rounded-md shadow-xs select-none pointer-events-none">
                    <span>Ctrl</span>
                    <span>K</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className={cn(
                      "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10",
                      filtersOpen && "text-[var(--accent)]"
                    )}
                    aria-label="Search filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </form>

              {filtersOpen && (
                <div
                  ref={filterPopoverRef}
                  className="absolute left-0 top-12 z-50 w-[min(calc(100vw-2rem),36rem)] rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
                    <span className="text-sm font-extrabold text-[var(--app-text)]">Advanced Search Filters</span>
                    <button type="button" onClick={clearFilters} className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer">Clear All</button>
                  </div>

                  <div className="mt-4 space-y-3.5">
                    {/* Row 1: File Type & Connected Account */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">File Type</span>
                        <div className="mt-1">
                          <CustomSelect
                            value={filterKind}
                            onChange={(val) => setFilterKind(val)}
                            placeholder="All Types"
                            size="sm"
                            options={[
                              { value: '', label: 'All Types' },
                              { value: 'image', label: 'Image' },
                              { value: 'video', label: 'Video' },
                              { value: 'pdf', label: 'PDF' },
                              { value: 'doc', label: 'Document' },
                              { value: 'archive', label: 'Archive' },
                            ]}
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Connected Account</span>
                        <div className="mt-1">
                          <CustomSelect
                            value={filterAccountId}
                            onChange={(val) => setFilterAccountId(val)}
                            placeholder="All Accounts"
                            size="sm"
                            options={[
                              { value: '', label: 'All Accounts' },
                              ...accounts.map((acc) => ({
                                value: acc.id,
                                label: `${acc.email} (${acc.provider})`,
                              })),
                            ]}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Size Range */}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Size Range (MB)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Min (e.g. 1)"
                          value={filterMinSize}
                          onChange={(e) => setFilterMinSize(e.target.value)}
                          className="block w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                        />
                        <span className="text-[var(--app-text-muted)] text-xs font-semibold shrink-0">to</span>
                        <input
                          type="number"
                          placeholder="Max (e.g. 500)"
                          value={filterMaxSize}
                          onChange={(e) => setFilterMaxSize(e.target.value)}
                          className="block w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Row 3: Date Range (Full Width - Zero Overflow) */}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Date Range</label>
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 items-center gap-2.5">
                        <input
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                          aria-label="Start date"
                          className="block w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none cursor-pointer"
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[var(--app-text-muted)] text-xs font-semibold shrink-0 hidden sm:inline">to</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            aria-label="End date"
                            className="block w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2 border-t border-[var(--card-border)] pt-4">
                    <Button variant="outline" size="sm" type="button" onClick={() => setFiltersOpen(false)}>Cancel</Button>
                    <Button variant="default" size="sm" type="button" onClick={applyFilters}>Apply Filters</Button>
                  </div>
                </div>
              )}
            </div>
            {/* Header actions injected by child pages */}
            {headerActions ? (
              <div data-tour="upload" className="hidden lg:flex items-center gap-2 shrink-0">
                {headerActions}
              </div>
            ) : null}
             <div className="relative hidden flex-wrap gap-2 lg:flex shrink-0">
              <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={toggleMode} className="border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)]">
                {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
              </Button>
              <div data-tour="notifications" className="relative shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="relative cursor-pointer"
                  aria-label="Notification center"
                  aria-expanded={infoOpen}
                  onClick={() => setInfoOpen(!infoOpen)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-75">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
                {infoOpen ? <NotificationCenter storage={storage} onClose={() => setInfoOpen(false)} /> : null}
              </div>
            </div>
          </header>
          <Outlet context={{ setHeaderActions } satisfies DriveLayoutContext} />
        </section>
      </div>

      {uploadProgress.open ? (
        <div className="fixed inset-x-3 bottom-3 z-[70] max-h-[70dvh] overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] shadow-2xl shadow-black/40 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(420px,calc(100vw-2.5rem))]">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3 bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2 font-extrabold text-sm text-[var(--app-text)]">
              {uploadProgress.status === 'done' ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : uploadProgress.status === 'partial' || uploadProgress.status === 'error' ? <X className="h-5 w-5 text-red-500" /> : <Upload className="h-5 w-5 text-[var(--accent)]" />}
              {uploadProgress.status === 'done' ? 'Upload complete' : uploadProgress.status === 'partial' ? 'Upload completed with errors' : uploadProgress.status === 'error' ? 'Upload failed' : uploadProgress.percent >= 99 ? 'Processing on server' : 'Uploading files'}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUploadProgressCollapsed(!uploadProgressCollapsed)}><ChevronDown className={cn("h-4 w-4 transition-transform", uploadProgressCollapsed && "rotate-180")} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUploadProgress((current) => ({ ...current, open: false }))}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          {!uploadProgressCollapsed && (
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="truncate font-semibold text-[var(--app-text)]">{uploadProgress.fileName}</p>
                <span className="text-[var(--app-text-muted)]">{uploadProgress.percent}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-black/10 dark:bg-white/10">
                <div className={uploadProgress.status === 'error' || uploadProgress.status === 'partial' ? 'h-full rounded-full bg-red-500' : uploadProgress.status === 'done' ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-[var(--accent)]'} style={{ width: `${uploadProgress.percent}%` }} />
              </div>
              {uploadProgress.files.length > 0 ? (
                <div className="mt-4 grid max-h-64 gap-3 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 text-[var(--app-text)]">
                  {uploadProgress.files.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="grid gap-1 rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-3">
                      <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                        <p className="min-w-0 flex-1 truncate font-semibold text-[var(--app-text)]" title={file.name}>{file.name}</p>
                        <span className="shrink-0 text-xs text-[var(--app-text-muted)]">{file.percent}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-[var(--app-text-muted)]">
                        <span>{formatBytes(file.size)}</span>
                        <div className="flex items-center gap-2">
                          {file.status === 'error' && (
                            <Button variant="default" className="h-6 px-2 text-[11px] font-extrabold text-white bg-red-600 hover:bg-red-700 shadow-none border-none" onClick={() => retryFailedUpload(file.name)}>
                              Retry
                            </Button>
                          )}
                          <span className={file.status === 'error' ? 'font-semibold text-red-600' : file.status === 'done' ? 'font-semibold text-emerald-600' : 'font-semibold text-[var(--accent)]'}>
                            {file.status === 'error' ? 'Failed' : file.status === 'done' ? 'Done' : file.percent >= 99 ? 'Processing' : 'Uploading'}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                        <div className={file.status === 'error' ? 'h-full rounded-full bg-red-500' : file.status === 'done' ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-[var(--accent)]'} style={{ width: `${file.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Keyboard Shortcuts Sheet Modal */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Interactive Draggable & Guided Tour Mascot */}
      <DashboardMascot />

      {/* Floating Real-Time Toast Notifications */}
      <ToastContainer />
    </main>
  )
}
