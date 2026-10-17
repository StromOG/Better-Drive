import { useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PreferenceItem {
  eventType: string
  channel: 'in_app'
  enabled: boolean
}

const EVENT_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  'upload.complete': {
    title: 'Upload Completed',
    desc: 'Receive an in-app alert when single or bulk file uploads finish processing.',
  },
  'upload.failed': {
    title: 'Upload Failed',
    desc: 'Get notified immediately if an upload encounters a network drop or quota error.',
  },
  'storage.warning': {
    title: 'Storage Warning',
    desc: 'Alert when pooled storage or individual connected accounts exceed 85% capacity.',
  },
  'member.invited': {
    title: 'Member Invited / Joined',
    desc: 'Notification when an admin invites a new member or a member accepts an invitation.',
  },
  'share.accessed': {
    title: 'Public Share Accessed',
    desc: 'Alert when one of your public file or folder links is opened or downloaded.',
  },
}

export function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<PreferenceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState(false)

  const fetchPreferences = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ preferences: PreferenceItem[] }>('/me/notifications/preferences')
      setPreferences(data.preferences || [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPreferences()
  }, [])

  const handleToggle = async (eventType: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled
    setSavingKey(eventType)

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) => (p.eventType === eventType ? { ...p, enabled: nextEnabled } : p)),
    )

    try {
      await apiFetch('/me/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          preferences: [{ eventType, enabled: nextEnabled }],
        }),
      })
      setSuccessMessage(true)
      setTimeout(() => setSuccessMessage(false), 2000)
    } catch {
      // Revert on failure
      setPreferences((prev) =>
        prev.map((p) => (p.eventType === eventType ? { ...p, enabled: currentEnabled } : p)),
      )
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--card-border)]">
        <div>
          <h2 className="text-lg font-black text-[var(--app-text)]">Notification Preferences</h2>
          <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
            Configure which events trigger real-time in-app alerts and notifications.
          </p>
        </div>

        {successMessage && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 animate-in fade-in">
            <Check className="w-4 h-4" />
            Preferences updated
          </span>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          preferences.map((pref) => {
            const info = EVENT_DESCRIPTIONS[pref.eventType] || {
              title: pref.eventType,
              desc: 'Event notification',
            }
            return (
              <div
                key={pref.eventType}
                className="p-5 flex items-center justify-between gap-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition"
              >
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {info.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {info.desc}
                  </p>
                </div>

                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pref.enabled}
                      disabled={savingKey === pref.eventType}
                      onChange={() => handleToggle(pref.eventType, pref.enabled)}
                      className="sr-only peer"
                      aria-label={`Toggle notifications for ${info.title}`}
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/40 flex items-start gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-400" />
        <span>
          Email notifications are currently deferred until SMTP mail server integration is configured on the host. In-app alerts will display inside the notification bell drawer.
        </span>
      </div>
    </div>
  )
}
