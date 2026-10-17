import { useEffect, useState } from 'react'
import { Check, Trash2, Camera, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth'
import { AvatarPickerModal } from '@/components/settings/AvatarPickerModal'
import { ThemeSettingsCard } from '@/components/settings/ThemeSettingsCard'
import { MascotSettingsCard } from '@/components/mascot'
import { BackupRestoreCard } from '@/components/settings/BackupRestoreCard'

export function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [displayName, setDisplayName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [emailPassword, setEmailPassword] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Avatar picker
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  // Account deletion
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((data) => {
        if (data.user) {
          setUser(data.user)
          setDisplayName(data.user.name || '')
          setEmail(data.user.email || '')
          updateStoredUser(data.user)
        }
      })
      .catch(() => undefined)
  }, [])

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setIsUpdatingName(true)
    setNameSuccess(false)
    try {
      const data = await apiFetch<{ user: AuthUser }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: displayName.trim() }),
      })
      setUser(data.user)
      updateStoredUser(data.user)
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !emailPassword) return
    setIsUpdatingEmail(true)
    setEmailError(null)
    setEmailSuccess(false)
    try {
      const data = await apiFetch<{ status: string; user: AuthUser }>('/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: emailPassword,
          newEmail: email.trim().toLowerCase(),
        }),
      })
      setUser(data.user)
      updateStoredUser(data.user)
      setEmailPassword('')
      setEmailSuccess(true)
      setTimeout(() => setEmailSuccess(false), 3000)
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to update email address.')
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    setIsUpdatingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) return
    setIsDeletingAccount(true)
    setDeleteError(null)
    try {
      await apiFetch('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      })
      clearAuthSession()
      window.location.href = '/login'
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account.')
      setIsDeletingAccount(false)
    }
  }

  const profileImageUrl = user?.avatarUrl || ''

  return (
    <div className="w-full space-y-6">
      {/* 1. Account & Avatar Overview Hero Card */}
      <Card className="p-4 sm:p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => setIsAvatarPickerOpen(true)}
              title="Click to customize account avatar or upload custom logo"
            >
              {!profileImageUrl || avatarError ? (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white shadow-sm border border-blue-400/20 transition-transform group-hover:scale-105">
                  {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
                </div>
              ) : (
                <img
                  src={profileImageUrl}
                  alt="User avatar"
                  className="h-14 w-14 rounded-2xl object-cover border border-[var(--card-border)] shadow-xs transition-transform group-hover:scale-105"
                  onError={() => setAvatarError(true)}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white drop-shadow-sm" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[var(--app-text)] leading-tight truncate">
                  {user?.name ?? displayName ?? 'User'}
                </h2>
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20 capitalize">
                  {user?.role ?? 'Member'}
                </span>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {user?.status ?? 'Active'}
                </span>
              </div>
              <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-1 truncate">
                {user?.email ?? '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAvatarPickerOpen(true)}
              className="text-xs font-bold gap-2 border-[var(--card-border)] text-[var(--app-text)] hover:border-blue-500/50 hover:bg-blue-500/5"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              Customize Avatar / Logo
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Theme & Appearance Customization */}
      <ThemeSettingsCard />

      {/* 3. Mascot Companion Customization */}
      <MascotSettingsCard />

      {/* 4. Credentials & Security Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Name & Details */}
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-[var(--app-text)]">Display Name</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Your name displayed across workspace activities, shares, and team audit logs.
            </p>

            <form onSubmit={handleUpdateName} className="mt-4 space-y-3">
              <div>
                <label htmlFor="display-name" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
                  Full Name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={isUpdatingName || !displayName.trim()}>
                  {isUpdatingName ? 'Saving...' : 'Save Name'}
                </Button>
                {nameSuccess && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-4 h-4" /> Name Updated
                  </span>
                )}
              </div>
            </form>
          </div>
        </Card>

        {/* Change Email */}
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-[var(--app-text)]">Change Email</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Update your primary login email address. Current password required.
            </p>

            {emailError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                {emailError}
              </div>
            )}

            <form onSubmit={handleUpdateEmail} className="mt-4 space-y-3">
              <div>
                <label htmlFor="account-email" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
                  New Email Address
                </label>
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="email-password-confirm" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
                  Current Password
                </label>
                <Input
                  id="email-password-confirm"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={isUpdatingEmail || !emailPassword || !email.trim()}>
                  {isUpdatingEmail ? 'Updating...' : 'Update Email'}
                </Button>
                {emailSuccess && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-4 h-4" /> Email Updated
                  </span>
                )}
              </div>
            </form>
          </div>
        </Card>
      </div>

      {/* 5. Change Password Card */}
      <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <h3 className="text-sm font-black text-[var(--app-text)]">Security & Password</h3>
        <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
          Requires your existing password. Terminates other active sessions upon update.
        </p>

        {passwordError && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-4 grid gap-3 sm:grid-cols-3 max-w-3xl">
          <div>
            <label htmlFor="current-pw" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
              Current Password
            </label>
            <Input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="new-pw" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
              New Password (min 8)
            </label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-pw" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
              Confirm Password
            </label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={isUpdatingPassword || !currentPassword || !newPassword}>
              {isUpdatingPassword ? 'Updating Password...' : 'Change Password'}
            </Button>
            {passwordSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" /> Password Changed
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* 6. Database Backup & Disaster Recovery */}
      <BackupRestoreCard />

      {/* 7. Danger Zone */}
      <Card className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <h3 className="text-sm font-black text-red-600 dark:text-red-400">Danger Zone</h3>
        <p className="text-xs text-[var(--app-text-muted)] mt-1">
          Delete or disable your account. If you are the sole instance owner, transfer ownership before proceeding.
        </p>
        <div className="mt-3.5">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete Account
          </Button>
        </div>
      </Card>

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[var(--app-text)]">Confirm Account Deletion</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-2">
              Please enter your password to confirm deleting your account. This will disable your login and revoke all active sessions.
            </p>

            {deleteError && (
              <div className="mt-3 p-2.5 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-600">
                {deleteError}
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="delete-account-password" className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
                Password
              </label>
              <Input
                id="delete-account-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || !deletePassword}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {isAvatarPickerOpen && (
        <AvatarPickerModal
          isOpen={isAvatarPickerOpen}
          user={user}
          currentAvatarUrl={user?.avatarUrl || ''}
          onAvatarChanged={(url: string) => {
            if (user) {
              const updated = { ...user, avatarUrl: url }
              setUser(updated)
              updateStoredUser(updated)
            }
            setIsAvatarPickerOpen(false)
          }}
          onClose={() => setIsAvatarPickerOpen(false)}
        />
      )}
    </div>
  )
}
