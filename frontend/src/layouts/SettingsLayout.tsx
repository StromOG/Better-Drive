import { Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/drive/PageHeader'
import { SettingsTabs } from '@/components/settings/SettingsTabs'

export function SettingsLayout() {
  return (
    <div className="w-full space-y-6">
      {/* 100% Fixed, Stable Settings Header & Description */}
      <PageHeader
        title="Settings & Workspace"
        description="Manage your account profile, theme appearance, companion mascot, storage providers, setup guides, and workspace members."
      />

      {/* Rock-solid Tab Navigation Bar - No jumping or layout shift */}
      <SettingsTabs />

      {/* Active Tab View */}
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  )
}
