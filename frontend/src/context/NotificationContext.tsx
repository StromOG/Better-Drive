import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory =
  | 'upload'
  | 'storage'
  | 'security'
  | 'backup'
  | 'sftp'
  | 'system'

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: NotificationType
  category: NotificationCategory
  timestamp: string // ISO date string
  read: boolean
  link?: string
  actionLabel?: string
}

export interface ToastItem {
  id: string
  title: string
  message: string
  type: NotificationType
  duration?: number
  link?: string
  actionLabel?: string
  createdAt: number
}

interface NotifyOptions {
  type?: NotificationType
  category?: NotificationCategory
  duration?: number
  link?: string
  actionLabel?: string
  saveToCenter?: boolean
}

interface NotificationContextValue {
  notifications: NotificationItem[]
  toasts: ToastItem[]
  unreadCount: number
  notify: {
    (title: string, message: string, options?: NotifyOptions): void
    success: (title: string, message: string, options?: NotifyOptions) => void
    error: (title: string, message: string, options?: NotifyOptions) => void
    warning: (title: string, message: string, options?: NotifyOptions) => void
    info: (title: string, message: string, options?: NotifyOptions) => void
  }
  dismissToast: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const STORAGE_KEY = 'betterdrive:notifications:v2'

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-welcome-1',
    title: 'Storage Vault Online',
    message: 'Your Better Drive unified cloud vault is active and ready for secure streaming.',
    type: 'success',
    category: 'system',
    timestamp: new Date().toISOString(),
    read: false,
    link: '/quota',
    actionLabel: 'View Quota',
  },
  {
    id: 'notif-sftp-2',
    title: 'SFTP Gateway Active',
    message: 'Key-only SSH/SFTP endpoint is running on port 2222. Add BetterDrive in Termius.',
    type: 'info',
    category: 'sftp',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
    link: '/settings',
    actionLabel: 'SFTP Keys',
  },
  {
    id: 'notif-security-3',
    title: 'AES-256 Token Encryption',
    message: 'Token hashing and privilege separation active across all storage engines.',
    type: 'info',
    category: 'security',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    read: true,
    link: '/activity',
    actionLabel: 'Audit Logs',
  },
]

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // ignore
    }
    return INITIAL_NOTIFICATIONS
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)))
    } catch {
      // storage full or disabled
    }
  }, [notifications])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<ToastItem, 'id' | 'createdAt'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const duration = toast.duration ?? 4500
    const newToast: ToastItem = {
      ...toast,
      id,
      duration,
      createdAt: Date.now(),
    }

    setToasts((prev) => [...prev.slice(-4), newToast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const notifyFn = useCallback(
    (title: string, message: string, options: NotifyOptions = {}) => {
      const type = options.type || 'info'
      const category = options.category || 'system'
      const duration = options.duration ?? 4500
      const saveToCenter = options.saveToCenter !== false

      // Trigger floating popup toast
      addToast({
        title,
        message,
        type,
        duration,
        link: options.link,
        actionLabel: options.actionLabel,
      })

      // Record into Notification Center
      if (saveToCenter) {
        const newItem: NotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          message,
          type,
          category,
          timestamp: new Date().toISOString(),
          read: false,
          link: options.link,
          actionLabel: options.actionLabel,
        }
        setNotifications((prev) => [newItem, ...prev.slice(0, 49)])
      }
    },
    [addToast]
  )

  const notify = Object.assign(notifyFn, {
    success: (title: string, message: string, options?: NotifyOptions) =>
      notifyFn(title, message, { ...options, type: 'success' }),
    error: (title: string, message: string, options?: NotifyOptions) =>
      notifyFn(title, message, { ...options, type: 'error' }),
    warning: (title: string, message: string, options?: NotifyOptions) =>
      notifyFn(title, message, { ...options, type: 'warning' }),
    info: (title: string, message: string, options?: NotifyOptions) =>
      notifyFn(title, message, { ...options, type: 'info' }),
  })

  // Listen for global custom events from any subcomponent
  useEffect(() => {
    function handleCustomEvent(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail && detail.title && detail.message) {
        notify(detail.title, detail.message, detail)
      }
    }
    window.addEventListener('betterdrive:notify', handleCustomEvent)
    return () => window.removeEventListener('betterdrive:notify', handleCustomEvent)
  }, [notify])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        notify,
        dismissToast,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
