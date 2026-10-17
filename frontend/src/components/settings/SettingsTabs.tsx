import { NavLink } from 'react-router-dom'
import { Bell, Cloud, ShieldCheck, User } from 'lucide-react'
import { getStoredUser } from '@/lib/auth'

export function SettingsTabs() {
  const user = getStoredUser()
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin'

  const tabs = [
    { label: 'Profile & Appearance', href: '/settings/profile', icon: User },
    ...(isOwnerOrAdmin ? [{ label: 'Members', href: '/settings/members', icon: ShieldCheck }] : []),
    { label: 'Connected Accounts & Storage', href: '/settings/accounts', icon: Cloud },
    { label: 'Notifications', href: '/settings/notifications', icon: Bell },
  ]

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 mb-6">
      <nav className="flex space-x-6 overflow-x-auto no-scrollbar" aria-label="Settings navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 py-3.5 px-1 border-b-2 text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
