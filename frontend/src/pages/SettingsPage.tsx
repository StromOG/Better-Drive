import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, Camera, Check, CheckCircle2, ChevronDown, Cloud, Copy, Cpu, Database, Download, ExternalLink, FileArchive, FileCode, Globe, HardDrive, HelpCircle, KeyRound, Layers, Link2, Lock, Moon, Network, Palette, RefreshCw, ShieldCheck, Sparkles, Sun, Terminal, Trash2, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/select'
import { DummyModal } from '@/components/drive/DummyModal'
import { PageHeader } from '@/components/drive/PageHeader'
import { apiFetch, formatBytes, API_URL } from '@/lib/api'
import { getGravatarUrl } from '@/lib/gravatar'
import { getStoredUser, updateStoredUser, getAccessToken, clearAuthSession, type AuthUser } from '@/lib/auth'
import { useTheme, APP_THEMES } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { MascotSettingsCard } from '@/components/mascot'
import { AvatarPickerModal } from '@/components/settings/AvatarPickerModal'
import { useNotifications } from '@/context/NotificationContext'

type ConnectedAccount = { id: string; provider: string; email: string; displayName?: string | null; status: string; storageAccount?: { totalBytes: string | null; usedBytes: string; availableBytes: string | null; lastSyncedAt: string | null } | null }

function providerLabel(provider: string) {
  if (provider === 's3') return 'S3 Storage'
  return 'Google Drive'
}

function storageLimitLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.totalBytes === null) return 'Unlimited'
  return formatBytes(account.storageAccount?.totalBytes)
}

function availableLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.availableBytes === null) return 'Unlimited'
  return formatBytes(account.storageAccount?.availableBytes)
}

export function SettingsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'providers' | 'guide' | 'terminal' | 'map') || 'providers'
  const initialProvider = (searchParams.get('provider') as 'google' | 'r2' | 'minio' | 'aws' | 'b2' | 'wasabi' | 'policy') || 'google'

  const [user, setUser] = useState<AuthUser | null>(getStoredUser())
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const { currentTheme, themeConfig, setTheme, toggleMode } = useTheme()
  const [appearanceExpanded, setAppearanceExpanded] = useState(false)
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [message, setMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [s3Open, setS3Open] = useState(false)
  const [connectingS3, setConnectingS3] = useState(false)
  const [testingS3, setTestingS3] = useState(false)
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [s3Form, setS3Form] = useState({ name: '', bucket: '', region: 'us-east-1', endpoint: '', accessKeyId: '', secretAccessKey: '', forcePathStyle: false, quotaBytes: '' })
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null)
  const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAccount | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState(() => getStoredUser()?.avatarUrl || '')
  const [avatarError, setAvatarError] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [hubTab, setHubTab] = useState<'providers' | 'guide' | 'terminal' | 'map'>(initialTab)
  const [guideProvider, setGuideProvider] = useState<'google' | 'r2' | 'minio' | 'aws' | 'b2' | 'wasabi' | 'policy'>(initialProvider)
  const [terminalTab, setTerminalTab] = useState<'env' | 'pwsh' | 'bash' | 'curl' | 's3cli' | 'rclone'>('env')
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null)

  function copySnippet(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedSnippetKey(key)
    setTimeout(() => setCopiedSnippetKey(null), 2000)
  }

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'providers' || t === 'guide' || t === 'terminal' || t === 'map') {
      setHubTab(t)
    }
    const p = searchParams.get('provider')
    if (p === 'google' || p === 'r2' || p === 'minio' || p === 'aws' || p === 'b2' || p === 'wasabi' || p === 'policy') {
      setGuideProvider(p)
    }
  }, [searchParams])

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
  // Google OAuth Config states
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleRedirectUri, setGoogleRedirectUri] = useState('')
  const [defaultRedirectUri, setDefaultRedirectUri] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [savingGoogleConfig, setSavingGoogleConfig] = useState(false)

  // Notifications
  const { notify } = useNotifications()

  // Backup & Restore states
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



  async function saveGoogleConfig(event: FormEvent) {
    event.preventDefault()
    setSavingGoogleConfig(true)
    setMessage('')
    try {
      const res = await apiFetch<{ message: string }>('/system/google-config', {
        method: 'POST',
        body: JSON.stringify({
          clientId: googleClientId,
          clientSecret: googleClientSecret || undefined,
          redirectUri: googleRedirectUri || defaultRedirectUri,
        }),
      })
      const successText = res.message || 'Google OAuth credentials saved.'
      setMessage(successText)
      notify.success('Google OAuth Saved', successText, { category: 'security' })
      setHasSecret(true)
      setGoogleClientSecret('')
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'Failed to save Google OAuth configuration'
      setMessage(errText)
      notify.error('OAuth Configuration Error', errText, { category: 'security' })
    } finally {
      setSavingGoogleConfig(false)
    }
  }

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null

  async function load() {
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts')
      setAccounts(data.accounts)
    } catch (e) {
      console.warn('Failed to load connected accounts', e)
    }

    try {
      const meData = await apiFetch<{ user: AuthUser }>('/auth/me')
      if (meData?.user) {
        const stored = getStoredUser()
        const merged: AuthUser = {
          ...stored,
          ...meData.user,
          avatarUrl: stored?.avatarUrl || meData.user.avatarUrl,
        }
        setUser(merged)
        updateStoredUser(merged)
        if (merged.avatarUrl) {
          setProfileImageUrl(merged.avatarUrl)
        }
      }
    } catch {
      // ignore
    }

    try {
      const configData = await apiFetch<{ exists: boolean; clientId: string; redirectUri: string; hasSecret: boolean; defaultRedirectUri: string }>('/system/google-config')
      if (configData.exists) {
        setGoogleClientId(configData.clientId || '')
        setGoogleRedirectUri(configData.redirectUri || '')
        setHasSecret(configData.hasSecret || false)
      }
      setDefaultRedirectUri(configData.defaultRedirectUri || '')
    } catch (e) {
      console.error('Failed to load global Google config', e)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  useEffect(() => {
    setAvatarError(false)
    if (user?.avatarUrl) {
      setProfileImageUrl(user.avatarUrl)
      return
    }
    const email = user?.email
    if (!email) return
    getGravatarUrl(email, 96).then((url) => {
      if (url) setProfileImageUrl(url)
    }).catch(() => setProfileImageUrl(''))
  }, [user?.email, user?.avatarUrl])

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId('')
      return
    }
    if (!accounts.some((account) => account.id === selectedAccountId)) setSelectedAccountId(accounts[0].id)
  }, [accounts, selectedAccountId])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'GOOGLE_CONNECTED') return
      const isSuccess = event.data.status === 'success'
      setMessage(isSuccess ? 'Google Drive connected.' : 'Google Drive connection failed.')
      if (isSuccess) {
        notify.success('Google Drive Connected', 'Your Google Drive account has been linked successfully.', { category: 'storage', link: '/quota', actionLabel: 'View Quota' })
      } else {
        notify.error('Connection Failed', 'Failed to connect Google Drive account.', { category: 'storage' })
      }
      load().then(() => {
        window.dispatchEvent(new Event('betterdrive:storage-changed'))
      }).catch(() => undefined)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [notify])

  async function connectDrive() {
    setConnecting(true)
    setMessage('')
    let popup: Window | null = null
    try {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url')
      popup = window.open('', 'google-drive-connect', 'width=540,height=720')
      if (popup) {
        popup.location.href = data.url
      } else {
        window.location.href = data.url
      }
    } catch (error: any) {
      if (popup) popup.close()
      const errMsg = error instanceof Error ? error.message : 'Failed to start Google Drive connection'
      if (errMsg.toLowerCase().includes('configured') || errMsg.toLowerCase().includes('oauth') || errMsg.toLowerCase().includes('missing')) {
        setGuideProvider('google')
        setHubTab('guide')
        setMessage('Please enter and save your Google OAuth Credentials first.')
      } else {
        setMessage(errMsg)
      }
    } finally {
      setConnecting(false)
    }
  }

  async function testS3() {
    if (!s3Form.bucket || !s3Form.accessKeyId || !s3Form.secretAccessKey) {
      setS3TestResult({ success: false, message: 'Please provide Bucket name, Access Key ID, and Secret Access Key.' })
      return
    }
    setTestingS3(true)
    setS3TestResult(null)
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/connected-accounts/s3/test', {
        method: 'POST',
        body: JSON.stringify({
          ...s3Form,
          endpoint: s3Form.endpoint || undefined,
          quotaBytes: s3Form.quotaBytes || null,
        }),
      })
      setS3TestResult({ success: true, message: res.message || 'Bucket connection verified successfully!' })
      notify.success('S3 Connection Verified', `Bucket "${s3Form.bucket}" is accessible and writable.`, { category: 'storage' })
    } catch (err: any) {
      const errMsg = err.message || 'Failed to connect to S3 bucket. Check credentials, region, and endpoint.'
      setS3TestResult({ success: false, message: errMsg })
      notify.error('S3 Test Failed', errMsg, { category: 'storage' })
    } finally {
      setTestingS3(false)
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId)
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, { method: 'POST' })
      await load()
      window.dispatchEvent(new Event('betterdrive:storage-changed'))
      notify.success('Quota Synced', 'Storage quota refreshed successfully.', { category: 'storage' })
    } catch (err: any) {
      notify.error('Sync Failed', err.message || 'Failed to sync quota.', { category: 'storage' })
    } finally {
      setSyncingAccountId(null)
    }
  }

  async function disconnect() {
    if (!accountToDisconnect) return
    const accountName = accountToDisconnect.displayName || accountToDisconnect.email
    setDisconnectingAccountId(accountToDisconnect.id)
    setMessage('')
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, { method: 'DELETE' })
      setAccountToDisconnect(null)
      setMessage('Storage account disconnected.')
      notify.info('Account Disconnected', `${accountName} was successfully disconnected.`, { category: 'storage' })
      await load()
      window.dispatchEvent(new Event('betterdrive:storage-changed'))
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'Failed to disconnect storage account'
      setMessage(errText)
      notify.error('Disconnect Failed', errText, { category: 'storage' })
    } finally {
      setDisconnectingAccountId(null)
    }
  }

  async function connectS3(event: FormEvent) {
    event.preventDefault()
    setConnectingS3(true)
    setMessage('')
    try {
      const bucketName = s3Form.bucket
      await apiFetch('/connected-accounts/s3', { method: 'POST', body: JSON.stringify({ ...s3Form, endpoint: s3Form.endpoint || undefined, quotaBytes: s3Form.quotaBytes || null }) })
      setS3Open(false)
      setS3Form({ name: '', bucket: '', region: 'us-east-1', endpoint: '', accessKeyId: '', secretAccessKey: '', forcePathStyle: false, quotaBytes: '' })
      setMessage('S3 storage connected.')
      notify.success('S3 Storage Connected', `Bucket "${bucketName}" was connected successfully.`, { category: 'storage', link: '/quota', actionLabel: 'View Quota' })
      await load()
      window.dispatchEvent(new Event('betterdrive:storage-changed'))
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'Failed to connect S3 storage'
      setMessage(errText)
      notify.error('S3 Connection Failed', errText, { category: 'storage' })
    } finally {
      setConnectingS3(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage account, dashboard appearance, and connected storage."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setS3Open(true)}>
              <Database className="h-4 w-4" />Connect S3
            </Button>
            <Button size="sm" onClick={connectDrive} disabled={connecting}>
              <Link2 className="h-4 w-4" />{connecting ? 'Connecting...' : 'Connect Drive'}
            </Button>
          </>
        }
      />
      {message ? (
        <p className="mt-4 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-sm font-semibold text-blue-700 dark:text-blue-300 shadow-xs">
          {message}
        </p>
      ) : null}

      {/* Quick Status Bar */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Storage</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">{accounts.length} connected {accounts.length === 1 ? 'account' : 'accounts'}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Notifications</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Email & in-app alerts active</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Region</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Local Gateway (Online)</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4">
          {/* User Profile Card */}
          <Card className="p-4 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => setAvatarModalOpen(true)}
                  title="Click to customize account avatar or upload custom logo"
                >
                  {!profileImageUrl || avatarError ? (
                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-sm border border-blue-400/20 sm:h-14 sm:w-14 transition-transform group-hover:scale-105">
                      {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <img
                      src={profileImageUrl}
                      alt="User avatar"
                      className="h-13 w-13 rounded-2xl object-cover sm:h-14 sm:w-14 border border-[var(--card-border)] shadow-xs transition-transform group-hover:scale-105"
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
                      {user?.name ?? 'User'}
                    </h2>
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {user?.status ?? 'Active'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-0.5 truncate">
                    {user?.email ?? '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAvatarModalOpen(true)}
                  className="w-full sm:w-auto text-xs font-bold gap-2 border-[var(--card-border)] text-[var(--app-text)] hover:border-blue-500/50 hover:bg-blue-500/5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  Choose Account Avatar / Logo
                </Button>
              </div>
            </div>
          </Card>

          {/* Mascot & Storage Companion (Byte) Customization Section */}
          <MascotSettingsCard />

          {/* Dashboard Appearance & Themes Section */}
          <Card className="p-4 sm:p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-xs">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-[var(--app-text)] leading-tight">Theme & Appearance</h2>
                  <p className="text-xs font-semibold text-[var(--app-text-muted)]">Saved to account ({user?.email})</p>
                </div>
              </div>

              {/* Compact Quick Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Active Theme Preview Badge */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5">
                  <span className="text-xs font-black text-[var(--app-text)]">{themeConfig.name}</span>
                  <div className="flex items-center -space-x-1">
                    {themeConfig.palette.previewColors.slice(0, 3).map((c, i) => (
                      <span key={i} className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                {/* Custom Theme Dropdown Selector */}
                <div className="w-56 sm:w-64">
                  <CustomSelect
                    value={currentTheme}
                    onChange={(val) => setTheme(val)}
                    size="sm"
                    aria-label="Theme selector"
                    items={[
                      {
                        label: 'Light Themes',
                        options: APP_THEMES.filter((t) => t.mode === 'light').map((t) => ({
                          value: t.id,
                          label: `${t.name} — ${t.tagline}`,
                          colorDots: t.palette.previewColors,
                        })),
                      },
                      {
                        label: 'Dark Themes',
                        options: APP_THEMES.filter((t) => t.mode === 'dark').map((t) => ({
                          value: t.id,
                          label: `${t.name} — ${t.tagline}`,
                          colorDots: t.palette.previewColors,
                        })),
                      },
                    ]}
                  />
                </div>

                {/* Light/Dark Mode Switcher */}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={toggleMode}
                  className="h-9 px-2.5 text-xs font-bold gap-1.5"
                  title={themeConfig.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {themeConfig.mode === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                  <span className="capitalize">{themeConfig.mode}</span>
                </Button>

                {/* Collapsible Gallery Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setAppearanceExpanded(!appearanceExpanded)}
                  className="h-9 px-2.5 text-xs font-bold gap-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                  title={appearanceExpanded ? 'Collapse theme cards' : 'Show all theme cards'}
                >
                  <span>{appearanceExpanded ? 'Hide Gallery' : 'Browse Gallery'}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", appearanceExpanded && "rotate-180")} />
                </Button>
              </div>
            </div>

            {/* Collapsible Visual Theme Cards Grid */}
            {appearanceExpanded && (
              <div className="mt-5 pt-4 border-t border-[var(--card-border)] space-y-4 animate-in fade-in duration-200">
                {/* Light Themes */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--app-text)]">Light Themes</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {APP_THEMES.filter((t) => t.mode === 'light').map((t) => {
                      const isCurrent = currentTheme === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onPointerDown={() => setTheme(t.id)}
                          onClick={() => setTheme(t.id)}
                          className={cn(
                            'group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer',
                            isCurrent
                              ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/5 shadow-xs'
                              : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-slate-400/50 hover:bg-black/5 dark:hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <span className="font-black text-xs text-[var(--app-text)]">{t.name}</span>
                            {isCurrent && (
                              <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                                <Check className="h-2.5 w-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>

                          {/* Miniature Visual Palette Preview Bar */}
                          <div
                            className="w-full h-7 rounded-lg mb-2 flex items-center justify-between px-2.5 border transition-all"
                            style={{ backgroundColor: t.palette.bg, borderColor: t.palette.previewColors[2] }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="h-3 w-3 rounded-full shadow-xs" style={{ backgroundColor: t.palette.accent }} />
                              <span className="h-2 w-7 rounded-xs shadow-2xs" style={{ backgroundColor: t.palette.card }} />
                            </div>
                            <div className="flex items-center -space-x-1">
                              {t.palette.previewColors.map((color, idx) => (
                                <span
                                  key={idx}
                                  className="h-2.5 w-2.5 rounded-full border border-black/20 shadow-xs"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          <p className="text-[11px] font-medium text-[var(--app-text-muted)] line-clamp-2 mb-2">
                            {t.description}
                          </p>
                          <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-[var(--card-border)]">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{t.tagline}</span>
                            <div className="flex items-center -space-x-1">
                              {t.palette.previewColors.map((color, idx) => (
                                <span
                                  key={idx}
                                  className="h-3 w-3 rounded-full border border-white/80 dark:border-black/50 shadow-xs"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dark Themes */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--app-text)]">Dark Themes</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {APP_THEMES.filter((t) => t.mode === 'dark').map((t) => {
                      const isCurrent = currentTheme === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onPointerDown={() => setTheme(t.id)}
                          onClick={() => setTheme(t.id)}
                          className={cn(
                            'group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer',
                            isCurrent
                              ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/10 shadow-xs'
                              : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-slate-400/50 hover:bg-black/5 dark:hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <span className="font-black text-xs text-[var(--app-text)]">{t.name}</span>
                            {isCurrent && (
                              <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                                <Check className="h-2.5 w-2.5 stroke-[3]" /> Active
                              </span>
                            )}
                          </div>

                          {/* Miniature Visual Palette Preview Bar */}
                          <div
                            className="w-full h-7 rounded-lg mb-2 flex items-center justify-between px-2.5 border transition-all"
                            style={{ backgroundColor: t.palette.bg, borderColor: t.palette.previewColors[2] }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="h-3 w-3 rounded-full shadow-xs" style={{ backgroundColor: t.palette.accent }} />
                              <span className="h-2 w-7 rounded-xs shadow-2xs" style={{ backgroundColor: t.palette.card }} />
                            </div>
                            <div className="flex items-center -space-x-1">
                              {t.palette.previewColors.map((color, idx) => (
                                <span
                                  key={idx}
                                  className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-xs"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          <p className="text-[11px] font-medium text-[var(--app-text-muted)] line-clamp-2 mb-2">
                            {t.description}
                          </p>
                          <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-[var(--card-border)]">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{t.tagline}</span>
                            <div className="flex items-center -space-x-1">
                              {t.palette.previewColors.map((color, idx) => (
                                <span
                                  key={idx}
                                  className="h-3 w-3 rounded-full border border-black/40 shadow-xs"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Cloud Storage Providers: Google Drive & S3 side-by-side */}
          {/* Cloud Storage & Virtual Drive Pool Hub */}
          <Card className="overflow-hidden p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-4">
              {/* Hub Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-black tracking-tight text-[var(--app-text)]">
                        Cloud Storage & Virtual Drive Hub
                      </h2>
                      <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                        Pooled Quota
                      </span>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        AES-256 Vault
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--app-text-muted)]">
                      Pool multiple Google Drive accounts and S3 buckets into one unified virtual storage vault.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)] text-xs font-bold">
                  {[
                    { id: 'providers', label: 'Cloud Providers', icon: Cloud },
                    { id: 'guide', label: 'Setup Guide', icon: KeyRound },
                    { id: 'terminal', label: 'Terminal & Commands', icon: Terminal },
                    { id: 'map', label: 'Architecture & Map', icon: Network },
                  ].map((tab) => {
                    const Icon = tab.icon
                    const isActive = hubTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHubTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer",
                          isActive
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* TAB 1: CLOUD PROVIDERS */}
              {hubTab === 'providers' && (
                <div className="space-y-3.5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Google Drive Card */}
                    <div className="flex flex-col justify-between p-4 rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 shadow-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
                            <Cloud className="h-4 w-4 text-blue-600" />
                            <span>Google Drive</span>
                          </div>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                            hasSecret || googleClientId
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          )}>
                            {hasSecret || googleClientId ? 'OAuth Ready' : 'Needs Config'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                          15 GB free per account. Connect multiple accounts for unlimited aggregate pooling.
                        </p>
                      </div>
                      <div className="mt-3.5 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={connectDrive}
                          disabled={connecting}
                          className="flex-1 text-xs font-bold"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {connecting ? 'Connecting...' : 'Connect Drive'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setGuideProvider('google')
                            setHubTab('guide')
                          }}
                          className="px-2.5 text-xs font-bold cursor-pointer"
                          title="Open Google Drive Setup Guide"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Cloudflare R2 Card */}
                    <div className="flex flex-col justify-between p-4 rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 shadow-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
                            <Database className="h-4 w-4 text-amber-500" />
                            <span>Cloudflare R2</span>
                          </div>
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            Zero Egress Fees
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                          S3-compatible object storage with no download fees and generous 10GB free tier.
                        </p>
                      </div>
                      <div className="mt-3.5 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'Cloudflare R2 Bucket',
                              region: 'auto',
                              endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
                              forcePathStyle: false,
                            }))
                            setS3Open(true)
                          }}
                          className="flex-1 text-xs font-bold cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>Preset Setup</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setGuideProvider('r2')
                            setHubTab('guide')
                          }}
                          className="px-2.5 text-xs font-bold cursor-pointer"
                          title="Open R2 Setup Guide"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* MinIO Self-Hosted Card */}
                    <div className="flex flex-col justify-between p-4 rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 shadow-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
                            <HardDrive className="h-4 w-4 text-rose-500" />
                            <span>Local MinIO / NAS</span>
                          </div>
                          <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                            100% On-Premise
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                          Connect private home NAS or Docker MinIO with path-style S3 compatibility.
                        </p>
                      </div>
                      <div className="mt-3.5 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'Local MinIO Storage',
                              region: 'us-east-1',
                              endpoint: 'http://localhost:9000',
                              forcePathStyle: true,
                            }))
                            setS3Open(true)
                          }}
                          className="flex-1 text-xs font-bold cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                          <span>MinIO Preset</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setGuideProvider('minio')
                            setHubTab('guide')
                          }}
                          className="px-2.5 text-xs font-bold cursor-pointer"
                          title="Open MinIO Setup Guide"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* General S3 Connect Button Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/5 dark:bg-white/5 p-3 border border-[var(--card-border)] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--app-text-muted)]">
                        Need AWS S3, Wasabi, Backblaze B2, or custom S3 endpoint?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setGuideProvider('aws')
                          setHubTab('guide')
                        }}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        View Guides & Presets
                      </button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setS3TestResult(null)
                        setS3Open(true)
                      }}
                      className="gap-1.5 font-bold cursor-pointer"
                    >
                      <Database className="h-3.5 w-3.5 text-blue-500" />
                      <span>Connect Custom S3 Provider</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: IN-PAGE SETUP GUIDE */}
              {hubTab === 'guide' && (
                <div className="space-y-4 text-xs">
                  {/* Provider Pill Selector */}
                  <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)]">
                    {[
                      { id: 'google', label: 'Google Drive', icon: Cloud },
                      { id: 'r2', label: 'Cloudflare R2', icon: Database },
                      { id: 'minio', label: 'MinIO Local NAS', icon: HardDrive },
                      { id: 'aws', label: 'Amazon S3', icon: Database },
                      { id: 'b2', label: 'Backblaze B2', icon: Database },
                      { id: 'wasabi', label: 'Wasabi Hot Storage', icon: Database },
                      { id: 'policy', label: 'IAM Policy & CORS', icon: ShieldCheck },
                    ].map((tab) => {
                      const Icon = tab.icon
                      const isActive = guideProvider === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setGuideProvider(tab.id as any)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs",
                            isActive
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* GUIDE: GOOGLE DRIVE */}
                  {guideProvider === 'google' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-blue-500" />
                            Google Drive OAuth 2.0 PKCE Setup
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            Connect multiple Google Drive accounts (15 GB free each) into your pooled drive.
                          </p>
                        </div>
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-xs text-xs"
                        >
                          <span>Open Google Console</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-black">1</span>
                            Create Project & Enable Drive API
                          </span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            Create a Google Cloud project (e.g. <strong>BetterDrive</strong>). In <strong>APIs & Services → Library</strong>, search for <strong>Google Drive API</strong> and click <strong>Enable</strong>.
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-black">2</span>
                            Configure OAuth Consent Screen
                          </span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            Choose <strong>External</strong> user type. Under <strong>Test Users</strong>, add your personal Google account email so you can authenticate freely.
                          </p>
                        </div>
                      </div>

                      {/* Callback URIs */}
                      <div className="rounded-xl bg-black/10 dark:bg-white/10 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[var(--app-text)] text-[11px]">
                            Authorized Redirect URIs for Web Application:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const storageUri = defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`
                              const authUri = `${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`
                              copySnippet(`${storageUri}\n${authUri}`, 'both-uris')
                            }}
                            className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-[11px]"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy Both URIs</span>
                          </button>
                        </div>

                        <div className="space-y-2 font-mono text-[11px]">
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--card-bg)] p-2.5 border border-[var(--card-border)]">
                            <div className="truncate">
                              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block mb-0.5">Primary Storage Quota Callback:</span>
                              <span className="select-all text-[var(--app-text)] font-semibold">
                                {defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copySnippet(defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`, 'storage-uri')}
                              className="shrink-0 text-[10px] h-7 px-2.5 font-bold cursor-pointer"
                            >
                              Copy Storage URI
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--card-bg)] p-2.5 border border-[var(--card-border)]">
                            <div className="truncate">
                              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">1-Click Google Sign-In Callback:</span>
                              <span className="select-all text-[var(--app-text)] font-semibold">
                                {`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copySnippet(`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`, 'auth-uri')}
                              className="shrink-0 text-[10px] h-7 px-2.5 font-bold cursor-pointer"
                            >
                              Copy Login URI
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GUIDE: CLOUDFLARE R2 */}
                  {guideProvider === 'r2' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-amber-500" />
                            Cloudflare R2 Object Storage
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            Zero egress bandwidth fees, 10 GB free tier, full S3 API compatibility.
                          </p>
                        </div>
                        <a
                          href="https://dash.cloudflare.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition shadow-xs text-xs"
                        >
                          <span>Cloudflare Dash</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] block">1. Create Bucket</span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            Navigate to <strong>R2 → Create bucket</strong> (e.g. <code className="text-amber-500 font-bold">betterdrive-vault</code>).
                          </p>
                        </div>
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] block">2. Create API Token</span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            Under <strong>R2 Manage API Tokens</strong>, create a token with <strong>Object Read & Write</strong> permissions.
                          </p>
                        </div>
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] block">3. Copy Credentials</span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            Copy your <strong>Account ID</strong>, <strong>Access Key ID</strong>, and <strong>Secret Access Key</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-black/10 dark:bg-white/10 p-3.5 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-mono text-[11px] text-[var(--app-text)]">
                            <strong>Region:</strong> <code className="text-amber-500 font-bold">auto</code> | <strong>Endpoint:</strong> <code className="select-all">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</code> | <strong>Force Path Style:</strong> <code>false</code>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setS3TestResult(null)
                              setS3Form((prev) => ({
                                ...prev,
                                name: 'Cloudflare R2 Bucket',
                                region: 'auto',
                                endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
                                forcePathStyle: false,
                              }))
                              setS3Open(true)
                            }}
                            className="text-xs font-bold gap-1 cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Apply Preset & Connect R2</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GUIDE: MINIO / LOCAL NAS */}
                  {guideProvider === 'minio' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-rose-500" />
                            Local MinIO & On-Premises Home NAS
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            100% self-hosted, private local storage with path-style S3 compatibility.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'Local MinIO Storage',
                              region: 'us-east-1',
                              endpoint: 'http://localhost:9000',
                              forcePathStyle: true,
                            }))
                            setS3Open(true)
                          }}
                          className="text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Apply Preset & Connect MinIO</span>
                        </Button>
                      </div>

                      {/* High-Contrast Modern Terminal Code Card */}
                      <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                              <Terminal className="h-3.5 w-3.5 text-rose-400" />
                              docker-run.sh
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                              One-Liner
                            </span>
                            <button
                              type="button"
                              onClick={() => copySnippet(`docker run -d -p 9000:9000 -p 9001:9001 --name minio-betterdrive -v ~/minio-data:/data -e "MINIO_ROOT_USER=minioadmin" -e "MINIO_ROOT_PASSWORD=minioadmin" quay.io/minio/minio server /data --console-address ":9001"`, 'minio-docker')}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer"
                            >
                              {copiedSnippetKey === 'minio-docker' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>{copiedSnippetKey === 'minio-docker' ? 'Copied Command!' : 'Copy Docker Run'}</span>
                            </button>
                          </div>
                        </div>

                        <pre className="p-4 font-mono text-[11.5px] text-rose-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`docker run -d -p 9000:9000 -p 9001:9001 --name minio-betterdrive \\
  -v ~/minio-data:/data \\
  -e "MINIO_ROOT_USER=minioadmin" \\
  -e "MINIO_ROOT_PASSWORD=minioadmin" \\
  quay.io/minio/minio server /data --console-address ":9001"`}
                        </pre>

                        {/* Quick credential cards */}
                        <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2.5 py-1.5 border border-slate-700/50">
                            <span className="text-slate-400 font-semibold">Web UI:</span>
                            <code className="text-sky-300 font-bold select-all">http://localhost:9001</code>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2.5 py-1.5 border border-slate-700/50">
                            <span className="text-slate-400 font-semibold">Login:</span>
                            <code className="text-amber-300 font-bold select-all">minioadmin / minioadmin</code>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2.5 py-1.5 border border-slate-700/50">
                            <span className="text-slate-400 font-semibold">Bucket:</span>
                            <code className="text-rose-300 font-bold select-all">betterdrive-vault</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GUIDE: AWS S3 */}
                  {guideProvider === 'aws' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-blue-500" />
                            Amazon Web Services (AWS S3)
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            Enterprise high-availability cloud object storage with granular IAM policies.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'AWS S3 Bucket',
                              region: 'us-east-1',
                              endpoint: '',
                              forcePathStyle: false,
                            }))
                            setS3Open(true)
                          }}
                          className="text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Apply AWS S3 Preset</span>
                        </Button>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] block">1. Create Private Bucket</span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            In AWS S3 Console, create a bucket (e.g. <code className="text-blue-500 font-bold">betterdrive-vault</code>). Keep <strong>Block all public access</strong> ON for security.
                          </p>
                        </div>
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                          <span className="font-bold text-[var(--app-text)] block">2. IAM User Credentials</span>
                          <p className="mt-1 text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                            In IAM Console, create a service user, generate an <strong>Access Key</strong>, and attach the least-privilege policy from the policy tab.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GUIDE: BACKBLAZE B2 */}
                  {guideProvider === 'b2' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-emerald-500" />
                            Backblaze B2 Cloud Storage
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            Cost-effective S3-compatible cloud backup and media archiving.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'Backblaze B2 Bucket',
                              region: 'us-west-004',
                              endpoint: 'https://s3.us-west-004.backblazeb2.com',
                              forcePathStyle: false,
                            }))
                            setS3Open(true)
                          }}
                          className="text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Apply B2 Preset</span>
                        </Button>
                      </div>
                      <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                        Create a private bucket in Backblaze B2. Under <strong>Application Keys</strong>, generate a key with Read and Write access. Enter the endpoint shown on your bucket details page (e.g. <code className="text-emerald-500 font-bold select-all">https://s3.us-west-004.backblazeb2.com</code>).
                      </p>
                    </div>
                  )}

                  {/* GUIDE: WASABI */}
                  {guideProvider === 'wasabi' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-indigo-500" />
                            Wasabi Hot Cloud Storage
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            High performance S3 storage with zero egress and API request charges.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setS3TestResult(null)
                            setS3Form((prev) => ({
                              ...prev,
                              name: 'Wasabi Hot Storage',
                              region: 'us-east-1',
                              endpoint: 'https://s3.wasabisys.com',
                              forcePathStyle: false,
                            }))
                            setS3Open(true)
                          }}
                          className="text-xs font-bold gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Apply Wasabi Preset</span>
                        </Button>
                      </div>
                      <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                        Create a bucket in your preferred Wasabi region (e.g. <code>us-east-1</code>). Endpoint: <code className="text-indigo-500 font-bold select-all">https://s3.wasabisys.com</code>.
                      </p>
                    </div>
                  )}

                  {/* GUIDE: IAM POLICY & CORS */}
                  {guideProvider === 'policy' && (
                    <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            Minimal Least-Privilege IAM Policy
                          </span>
                          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)] font-semibold">
                            Attach to your AWS/Cloudflare API key for strict security without granting root access.
                          </p>
                        </div>
                      </div>

                      {/* High-Contrast IAM Policy Editor Container */}
                      <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                              iam-policy.json
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                              Least-Privilege JSON
                            </span>
                            <button
                              type="button"
                              onClick={() => copySnippet(JSON.stringify({
                                Version: "2012-10-17",
                                Statement: [{
                                  Effect: "Allow",
                                  Action: [
                                    "s3:ListBucket",
                                    "s3:GetBucketLocation",
                                    "s3:GetObject",
                                    "s3:PutObject",
                                    "s3:DeleteObject",
                                    "s3:AbortMultipartUpload",
                                    "s3:ListMultipartUploadParts"
                                  ],
                                  Resource: [
                                    "arn:aws:s3:::betterdrive-vault",
                                    "arn:aws:s3:::betterdrive-vault/*"
                                  ]
                                }]
                              }, null, 2), 'iam-policy')}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer"
                            >
                              {copiedSnippetKey === 'iam-policy' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>{copiedSnippetKey === 'iam-policy' ? 'Copied Policy!' : 'Copy IAM Policy JSON'}</span>
                            </button>
                          </div>
                        </div>

                        <pre className="p-4 font-mono text-[11.5px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::betterdrive-vault",
        "arn:aws:s3:::betterdrive-vault/*"
      ]
    }
  ]
}`}
                        </pre>
                        <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Provides strict read, write, and multipart streaming without granting dangerous account-level administrative permissions.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: IN-PAGE TERMINAL & CLI COMMANDS */}
              {hubTab === 'terminal' && (
                <div className="space-y-3.5 text-xs">
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-emerald-500" />
                        Terminal Setup & Headless Automation
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Zero GUI Needed
                      </span>
                    </div>
                    <p className="text-[var(--app-text-muted)] leading-relaxed">
                      Configure your cloud storage environment variables or execute terminal provisioning directly:
                    </p>

                    {/* Subtype selector */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { id: 'env', label: '1. backend/.env' },
                        { id: 'pwsh', label: '2. PowerShell' },
                        { id: 'bash', label: '3. Linux / Bash' },
                        { id: 'curl', label: '4. REST API cURL' },
                        { id: 's3cli', label: '5. AWS & MinIO CLI' },
                        { id: 'rclone', label: '6. Rclone Mapping' },
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setTerminalTab(sub.id as any)}
                          className={cn(
                            "px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer",
                            terminalTab === sub.id
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-black/5 dark:bg-white/5 text-[var(--app-text-muted)] hover:text-[var(--app-text)] border border-[var(--card-border)]"
                          )}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {/* High-Contrast Interactive Terminal Container */}
                    <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                            {terminalTab === 'env' && 'backend/.env'}
                            {terminalTab === 'pwsh' && 'setup.ps1'}
                            {terminalTab === 'bash' && 'setup.sh'}
                            {terminalTab === 'curl' && 'api-request.sh'}
                            {terminalTab === 's3cli' && 's3-provision.sh'}
                            {terminalTab === 'rclone' && 'rclone.conf'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                            {terminalTab === 'env' && 'Environment Config'}
                            {terminalTab === 'pwsh' && 'PowerShell Script'}
                            {terminalTab === 'bash' && 'Bash Script'}
                            {terminalTab === 'curl' && 'REST API'}
                            {terminalTab === 's3cli' && 'S3 CLI'}
                            {terminalTab === 'rclone' && 'Rclone Config'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const snippet =
                                terminalTab === 'env'
                                  ? `# Better Drive Google OAuth Configuration\nGOOGLE_CLIENT_ID="${googleClientId || 'your-client-id.apps.googleusercontent.com'}"\nGOOGLE_CLIENT_SECRET="${hasSecret ? '••••••••••••••••' : (googleClientSecret || 'your-client-secret')}"\nGOOGLE_REDIRECT_URI="${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}"`
                                  : terminalTab === 'pwsh'
                                  ? `Add-Content -Path .\\backend\\.env -Value "\`nGOOGLE_CLIENT_ID=${googleClientId || 'your-client-id'}\`nGOOGLE_CLIENT_SECRET=${googleClientSecret || 'your-client-secret'}\`nGOOGLE_REDIRECT_URI=${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}"\nnpm run setup`
                                  : terminalTab === 'bash'
                                  ? `printf "\\nGOOGLE_CLIENT_ID=${googleClientId || 'your-client-id'}\\nGOOGLE_CLIENT_SECRET=${googleClientSecret || 'your-client-secret'}\\nGOOGLE_REDIRECT_URI=${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}\\n" >> backend/.env\nnpm run setup`
                                  : terminalTab === 'curl'
                                  ? `curl -X POST http://localhost:4000/system/google-config \\\n  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"clientId":"${googleClientId || 'YOUR_CLIENT_ID'}","clientSecret":"${googleClientSecret || 'YOUR_CLIENT_SECRET'}"}'`
                                  : terminalTab === 's3cli'
                                  ? `# AWS CLI:\naws s3api create-bucket --bucket betterdrive-vault --region us-east-1\n\n# MinIO Client (mc):\nmc alias set myminio http://127.0.0.1:9000 minioadmin minioadmin\nmc mb myminio/betterdrive-vault`
                                  : `[betterdrive-s3]\ntype = s3\nprovider = Other\nenv_auth = false\naccess_key_id = <YOUR_ACCESS_KEY>\nsecret_access_key = <YOUR_SECRET_KEY>\nregion = auto\nendpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com\nforce_path_style = false`
                              copySnippet(snippet, 'term-tab')
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer"
                          >
                            {copiedSnippetKey === 'term-tab' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedSnippetKey === 'term-tab' ? 'Copied Command!' : 'Copy Command'}</span>
                          </button>
                        </div>
                      </div>

                      <pre className="p-4 font-mono text-[11.5px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
                        {terminalTab === 'env' && `# Better Drive Google OAuth Configuration\nGOOGLE_CLIENT_ID="${googleClientId || 'your-client-id.apps.googleusercontent.com'}"\nGOOGLE_CLIENT_SECRET="${hasSecret ? '••••••••••••••••' : (googleClientSecret || 'your-client-secret')}"\nGOOGLE_REDIRECT_URI="${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}"`}
                        {terminalTab === 'pwsh' && `Add-Content -Path .\\backend\\.env -Value "\`nGOOGLE_CLIENT_ID=${googleClientId || 'your-client-id'}\`nGOOGLE_CLIENT_SECRET=${googleClientSecret || 'your-client-secret'}\`nGOOGLE_REDIRECT_URI=${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}"\nnpm run setup`}
                        {terminalTab === 'bash' && `printf "\\nGOOGLE_CLIENT_ID=${googleClientId || 'your-client-id'}\\nGOOGLE_CLIENT_SECRET=${googleClientSecret || 'your-client-secret'}\\nGOOGLE_REDIRECT_URI=${defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}\\n" >> backend/.env\nnpm run setup`}
                        {terminalTab === 'curl' && `curl -X POST http://localhost:4000/system/google-config \\\n  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"clientId":"${googleClientId || 'YOUR_CLIENT_ID'}","clientSecret":"${googleClientSecret || 'YOUR_CLIENT_SECRET'}"}'`}
                        {terminalTab === 's3cli' && `# AWS CLI:\naws s3api create-bucket --bucket betterdrive-vault --region us-east-1\n\n# MinIO Client (mc):\nmc alias set myminio http://127.0.0.1:9000 minioadmin minioadmin\nmc mb myminio/betterdrive-vault`}
                        {terminalTab === 'rclone' && `[betterdrive-s3]\ntype = s3\nprovider = Other\nenv_auth = false\naccess_key_id = <YOUR_ACCESS_KEY>\nsecret_access_key = <YOUR_SECRET_KEY>\nregion = auto\nendpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com\nforce_path_style = false`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ARCHITECTURE & QUOTA POOLING MAP */}
              {hubTab === 'map' && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-sm">
                    {/* Header with live pulse indicator */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                          <Network className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-[var(--app-text)]">Multi-Drive Virtual Pooling Mesh</h3>
                          <p className="text-[11px] text-[var(--app-text-muted)]">Real-time load balancing, slice deduplication & zero-trust token isolation</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Active Pipeline
                      </div>
                    </div>

                    {/* Layer 1: Client Ingestion Layer */}
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">1</div>
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-4 w-4 text-blue-500" />
                            <strong className="text-sm font-extrabold text-[var(--app-text)]">Client Ingestion Layer (Browser & Web Workers)</strong>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                          Worker Parallelism
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2 pt-1">
                        <div className="rounded-lg border border-blue-500/20 bg-[var(--card-bg)] p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <Lock className="h-3.5 w-3.5 text-blue-500" />
                            <span>SHA-256 Checksums</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--app-text-muted)]">Web Worker background hashing validates chunks prior to wire transmission.</p>
                        </div>
                        <div className="rounded-lg border border-blue-500/20 bg-[var(--card-bg)] p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <UploadCloud className="h-3.5 w-3.5 text-blue-500" />
                            <span>Multipart Chunking</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--app-text-muted)]">Files are sliced into chunks for network resilience and high-throughput streaming.</p>
                        </div>
                        <div className="rounded-lg border border-blue-500/20 bg-[var(--card-bg)] p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                            <span>Zero-Knowledge Sign</span>
                          </div>
                          <p className="text-[10.5px] text-[var(--app-text-muted)]">Client only signs upload intents; raw cloud tokens never touch browser DOM.</p>
                        </div>
                      </div>
                    </div>

                    {/* Stream Connector 1 */}
                    <div className="flex flex-col items-center justify-center -my-1">
                      <div className="h-3 w-0.5 bg-gradient-to-b from-blue-500 to-emerald-500" />
                      <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700/80 text-[10px] font-mono font-bold shadow-xs">
                        <Lock className="h-3 w-3 text-emerald-400" />
                        <span>Encrypted Local RPC Channel</span>
                      </div>
                      <div className="h-3 w-0.5 bg-gradient-to-b from-emerald-500 to-teal-500" />
                    </div>

                    {/* Layer 2: Core Orchestration Gateway (:4000) */}
                    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-emerald-900/10 p-4 space-y-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">2</div>
                          <div className="flex items-center gap-1.5">
                            <Cpu className="h-4 w-4 text-emerald-500" />
                            <strong className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">Better Drive Core Orchestrator (Self-Hosted :4000)</strong>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          Smart Quota Router
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-emerald-500/20 bg-[var(--card-bg)] p-3 space-y-1 shadow-xs">
                          <div className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Dynamic Quota Balancer</span>
                          </div>
                          <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                            Calculates real-time quota headroom across all accounts and routes uploads to the slice with highest free capacity.
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-[var(--card-bg)] p-3 space-y-1 shadow-xs">
                          <div className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-teal-500" />
                            <span>AES-256 Token Vault</span>
                          </div>
                          <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                            Google OAuth refresh tokens and S3 keys are encrypted at rest with AES-256-GCM. Zero third-party telemetry.
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-[var(--card-bg)] p-3 space-y-1 shadow-xs">
                          <div className="font-extrabold text-xs text-[var(--app-text)] flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Cross-Drive Deduplication</span>
                          </div>
                          <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                            Global chunk indexing detects already stored files across all accounts to instantly link files without duplicating storage.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stream Connector 2 */}
                    <div className="flex flex-col items-center justify-center -my-1">
                      <div className="h-3 w-0.5 bg-gradient-to-b from-teal-500 to-indigo-500" />
                      <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700/80 text-[10px] font-mono font-bold shadow-xs">
                        <Layers className="h-3 w-3 text-indigo-400" />
                        <span>Virtualized Storage Driver Bus (S3 SDK & Google Drive v3 API)</span>
                      </div>
                      <div className="h-3 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500" />
                    </div>

                    {/* Layer 3: Physical Storage Slices (Distributed Backends) */}
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-[var(--card-bg)] to-blue-500/5 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <Cloud className="h-4 w-4 text-blue-500" />
                            Google Drive #1
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                            15 GB Free
                          </span>
                        </div>
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-500 h-1.5 rounded-full w-[45%]" />
                        </div>
                        <p className="text-[10.5px] text-[var(--app-text-muted)]">Primary active pool slice with automated token rotation and high-speed Google edge delivery.</p>
                      </div>

                      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-[var(--card-bg)] to-sky-500/5 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <Cloud className="h-4 w-4 text-sky-500" />
                            Google Drive #2
                          </span>
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                            15 GB Free
                          </span>
                        </div>
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-sky-500 h-1.5 rounded-full w-[20%]" />
                        </div>
                        <p className="text-[10.5px] text-[var(--app-text-muted)]">Secondary expansion account: seamlessly handles overflow when primary quota approaches capacity.</p>
                      </div>

                      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-[var(--card-bg)] to-indigo-500/5 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-xs text-[var(--app-text)]">
                            <Database className="h-4 w-4 text-indigo-500" />
                            S3 / R2 / MinIO
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                            Unlimited Tier
                          </span>
                        </div>
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full w-full" />
                        </div>
                        <p className="text-[10.5px] text-[var(--app-text-muted)]">Zero-egress object storage for large media, system backups, or on-premises home NAS storage.</p>
                      </div>
                    </div>

                    {/* Output Banner: Unified Virtual Drive */}
                    <div className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 p-3.5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <strong className="text-xs font-black block text-white">Unified Virtual Filesystem Mesh</strong>
                          <span className="text-[11px] text-white/90">Single root explorer, transparent multi-drive failover, and zero storage caps.</span>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-black/25 backdrop-blur-xs border border-white/20 text-[11px] font-mono font-bold text-white shrink-0">
                        1 Virtual Pool • N Storage Accounts
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Connected Storage Accounts */}
          <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <HardDrive className="h-5 w-5 text-blue-600" />
                <h2 className="text-[16px] font-black text-[var(--app-text)]">Connected Storage Accounts</h2>
              </div>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-[11px] font-extrabold text-blue-700 dark:text-blue-300">
                {accounts.length} Active Storage Account{accounts.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid gap-3.5">
              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-8 text-center space-y-3">
                  <div className="h-12 w-12 mx-auto rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--app-text-muted)]">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-[var(--app-text)]">No cloud storage accounts connected yet</p>
                    <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-1 max-w-md mx-auto">
                      Link your Google Drive or S3 bucket above to enable auto-routing, quota pooling, and cloud file synchronization.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <Button size="sm" onClick={connectDrive} disabled={connecting} className="gap-1.5 font-bold text-xs">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Connect Google Drive</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setS3TestResult(null); setS3Open(true) }} className="gap-1.5 font-bold text-xs">
                      <Database className="h-3.5 w-3.5" />
                      <span>Connect S3 Storage</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-1.5 text-xs font-bold text-[var(--app-text)]">
                    <span>Select Storage Drive</span>
                    <CustomSelect
                      value={selectedAccount?.id ?? ''}
                      onChange={(val) => setSelectedAccountId(val)}
                      placeholder="Select an account"
                      options={accounts.map((account) => ({
                        value: account.id,
                        label: `${providerLabel(account.provider)} - ${account.displayName || account.email}`,
                        badge: (
                          <span className="rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-text-muted)]">
                            {account.status}
                          </span>
                        ),
                      }))}
                    />
                  </div>

                  {selectedAccount ? (
                    <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 border border-[var(--card-border)] space-y-3.5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-all font-black text-sm text-[var(--app-text)]">
                            {selectedAccount.displayName || selectedAccount.email}
                          </p>
                          <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-0.5">
                            {providerLabel(selectedAccount.provider)} · Status: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedAccount.status}</span>
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Button
                            className="w-full sm:w-auto text-xs font-bold"
                            size="sm"
                            variant="outline"
                            onClick={() => sync(selectedAccount.id)}
                            disabled={syncingAccountId === selectedAccount.id}
                          >
                            <RefreshCw className={syncingAccountId === selectedAccount.id ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                            <span>{syncingAccountId === selectedAccount.id ? 'Syncing...' : 'Sync Quota'}</span>
                          </Button>
                          <Button
                            className="w-full sm:w-auto text-xs font-bold"
                            size="sm"
                            variant="danger"
                            onClick={() => setAccountToDisconnect(selectedAccount)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Disconnect</span>
                          </Button>
                        </div>
                      </div>

                      {/* Quota metric cards */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-[var(--card-bg)] p-3 border border-[var(--card-border)] shadow-xs">
                          <p className="font-black text-sm text-[var(--app-text)]">{formatBytes(selectedAccount.storageAccount?.usedBytes)}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Used</p>
                        </div>
                        <div className="rounded-xl bg-[var(--card-bg)] p-3 border border-[var(--card-border)] shadow-xs">
                          <p className="font-black text-sm text-[var(--app-text)]">{storageLimitLabel(selectedAccount)}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Total Quota</p>
                        </div>
                        <div className="rounded-xl bg-[var(--card-bg)] p-3 border border-[var(--card-border)] shadow-xs">
                          <p className="font-black text-sm text-[var(--app-text)]">{availableLabel(selectedAccount)}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Available Free</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>

          {/* Google OAuth Credentials Card */}
          <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-[17px] font-black text-[var(--app-text)]">Google OAuth Credentials</h2>
                  <p className="text-xs font-semibold text-[var(--app-text-muted)]">
                    Configure your Google Cloud Project credentials for Drive storage and 1-click Sign-In.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-extrabold",
                  hasSecret || googleClientId
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                )}>
                  {hasSecret || googleClientId ? 'Configured & Active' : 'Setup Required'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5 cursor-pointer"
                  type="button"
                  onClick={() => {
                    setGuideProvider('google')
                    setHubTab('guide')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span>View Step-by-Step Guide</span>
                </Button>
              </div>
            </div>

            {/* Callback URIs Notification Box */}
            <div className="mb-4 rounded-2xl bg-black/5 dark:bg-white/5 p-4 border border-[var(--card-border)] space-y-2.5 text-xs">
              <p className="font-extrabold text-[var(--app-text)]">
                Authorized Redirect URIs for Google Cloud Console:
              </p>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between gap-2 rounded-xl bg-black/10 dark:bg-white/10 p-2.5 border border-[var(--card-border)]">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block font-sans">
                      Primary Drive Storage Callback:
                    </span>
                    <span className="select-all text-[var(--app-text)] truncate block">
                      {googleRedirectUri || defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(googleRedirectUri || defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`)
                      notify.success('Copied URI', 'Drive storage redirect URI copied to clipboard.')
                    }}
                    className="shrink-0 font-bold text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-black/10 dark:bg-white/10 p-2.5 border border-[var(--card-border)]">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block font-sans">
                      Google 1-Click Login Callback:
                    </span>
                    <span className="select-all text-[var(--app-text)] truncate block">
                      {`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`)
                      notify.success('Copied URI', 'Google Sign-In redirect URI copied to clipboard.')
                    }}
                    className="shrink-0 font-bold text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <form onSubmit={saveGoogleConfig} className="grid gap-3.5">
              <label className="grid gap-1.5 text-xs font-bold text-[var(--app-text)]">
                Client ID
                <input
                  className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none placeholder:text-[var(--app-text-muted)] font-mono"
                  placeholder="Enter Google Client ID"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--app-text)]">
                Client Secret {hasSecret && <span className="font-normal text-emerald-600 dark:text-emerald-400">(Already Configured - leave blank to keep)</span>}
                <input
                  className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none placeholder:text-[var(--app-text-muted)] font-mono"
                  type="password"
                  placeholder={hasSecret ? "••••••••••••••••••••••••" : "Enter Google Client Secret"}
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  required={!hasSecret}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-[var(--app-text)]">
                Custom Storage Redirect URI (Optional)
                <input
                  className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none placeholder:text-[var(--app-text-muted)] font-mono"
                  placeholder={defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}
                  value={googleRedirectUri}
                  onChange={(e) => setGoogleRedirectUri(e.target.value)}
                />
              </label>

              <div className="flex justify-end mt-1">
                <Button type="submit" disabled={savingGoogleConfig} size="sm" className="font-bold">
                  {savingGoogleConfig ? 'Saving...' : 'Save Credentials'}
                </Button>
              </div>
            </form>
          </Card>

          {/* System & Security Status */}
          <Card className="overflow-hidden p-4 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-[16px] font-black text-[var(--app-text)]">System & Security Status</h2>
                </div>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Production Hardened
                </span>
              </div>
              <div className="grid gap-2.5 text-xs sm:grid-cols-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[var(--app-text)]">Database Engine:</span>
                  <span className="font-semibold text-[var(--app-text-muted)]">SQLite Embedded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[var(--app-text)]">Max Upload Size:</span>
                  <span className="font-semibold text-[var(--app-text-muted)]">5 GB</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[var(--app-text)]">Token Storage:</span>
                  <span className="font-semibold text-[var(--app-text-muted)]">AES-256-GCM Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[var(--app-text)]">Password Hashing:</span>
                  <span className="font-semibold text-[var(--app-text-muted)]">Argon2id</span>
                </div>
              </div>
              <p className="text-[12px] font-medium text-[var(--app-text-muted)] pt-2 border-t border-[var(--card-border)]">
                To update your Better Drive instance, run <code className="bg-slate-500/10 px-1.5 py-0.5 rounded font-mono font-bold text-[var(--app-text)] border border-[var(--card-border)]">git pull && npm run setup</code> on your host.
              </p>
            </div>
          </Card>

          {/* Backup & Restore Database */}
          <Card id="backup-restore-card" className="overflow-hidden p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-black text-[var(--app-text)]">Backup & Restore Database</h2>
                    <p className="text-[12px] font-medium text-[var(--app-text-muted)]">
                      Universal snapshot and recovery with WAL checkpoints & automatic rollback safety.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNineDriveGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-black text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>9Drive Migration Guide</span>
                  </button>
                  <span className="hidden sm:inline-block rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                    SQLite Embedded · WAL Mode
                  </span>
                  <button
                    type="button"
                    onClick={fetchBackupStats}
                    disabled={loadingStats}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 transition"
                    title="Refresh database statistics"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loadingStats && "animate-spin")} />
                  </button>
                </div>
              </div>

              {/* Real-time DB Telemetry Stats */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--app-text-muted)]">
                    Active Database Telemetry
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[var(--app-text)]">
                    Size: {backupStats?.formattedSize ?? 'Calculating...'}
                    {backupStats?.walSizeBytes ? ` (+${backupStats.walFormattedSize} WAL buffer)` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    👥 {backupStats?.counts.users ?? 1} User{backupStats?.counts.users === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    📁 {backupStats?.counts.files ?? 0} File{backupStats?.counts.files === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    📂 {backupStats?.counts.folders ?? 0} Folder{backupStats?.counts.folders === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    ☁️ {backupStats?.counts.connectedAccounts ?? 0} Storage Account{backupStats?.counts.connectedAccounts === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    🔑 {backupStats?.counts.sftpProfiles ?? 0} SFTP Profile{backupStats?.counts.sftpProfiles === 1 ? '' : 's'} ({backupStats?.counts.sftpKeys ?? 0} Keys)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)]">
                    📋 {backupStats?.counts.auditLogs ?? 0} Audit & Session Logs
                  </span>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Download Backup Section */}
                <div className="rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-300 p-5 flex flex-col justify-between shadow-xs relative overflow-hidden group">
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


          {/* Termius & SFTP Gateway Setup Card */}
          <Card className="overflow-hidden p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-black text-[var(--app-text)]">Termius & SFTP Gateway Setup</h2>
                    <p className="text-[12px] font-medium text-[var(--app-text-muted)]">
                      Mount BetterDrive directly inside Termius on iOS, Android, macOS, or Windows via port 2222.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    SFTP Port 2222 Active
                  </span>
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    Zero-Password Public Key Auth
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 text-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--app-text)]">Termius Fast Connection Snippet</p>
                    <p className="text-[var(--app-text-muted)] text-[11px]">
                      Add host in Termius using your Ed25519/RSA public key. Passwords and interactive shells are disabled.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="termius://ssh/betterdrive@localhost:2222"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Termius
                    </a>
                    <Link
                      to="/termius"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-black/5 dark:hover:bg-white/5 font-semibold text-xs text-[var(--app-text)] transition-colors"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                      Manage SSH Keys
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs">
                  <code className="select-all">sftp -P 2222 betterdrive@localhost</code>
                  <span className="text-[10px] text-slate-400 font-sans">Public Key Auth Only</span>
                </div>
              </div>
            </div>
          </Card>
      </div>

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

          {/* Option C: Direct .env settings */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">3</span>
              <span>Option C: Drop 9Drive .env (Settings Only)</span>
            </div>
            <p className="text-[var(--app-text-muted)] leading-relaxed">
              Only want to migrate your Google Cloud Client ID and Secret? Drop your 9Drive <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">.env</code> file into the Restore zone to instantly configure Google Drive pooling.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="default" onClick={() => setNineDriveGuideOpen(false)}>
              Got it, let's restore
            </Button>
          </div>
        </div>
      </DummyModal>
      <DummyModal
        open={s3Open}
        title="Connect S3 Storage"
        description="Connect AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, or custom endpoint."
        onClose={() => {
          setS3Open(false)
          setS3TestResult(null)
        }}
      >
        <form className="grid gap-4" onSubmit={connectS3}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">Quick Provider Presets:</p>
              <button
                type="button"
                onClick={() => {
                  setS3Open(false)
                  setHubTab('guide')
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>In-Page Setup Guides & Maps</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'AWS S3', region: 'us-east-1', endpoint: '', forcePathStyle: false },
                { label: 'Cloudflare R2', region: 'auto', endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com', forcePathStyle: false },
                { label: 'MinIO', region: 'us-east-1', endpoint: 'http://localhost:9000', forcePathStyle: true },
                { label: 'Backblaze B2', region: 'us-west-004', endpoint: 'https://s3.us-west-004.backblazeb2.com', forcePathStyle: false },
                { label: 'Wasabi', region: 'us-east-1', endpoint: 'https://s3.wasabisys.com', forcePathStyle: false },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setS3TestResult(null)
                    setS3Form((prev) => ({ ...prev, name: prev.name || `${p.label} Bucket`, region: p.region, endpoint: p.endpoint, forcePathStyle: p.forcePathStyle }))
                  }}
                  className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {s3TestResult && (
            <div
              className={cn(
                "rounded-xl border p-3 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-150",
                s3TestResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
              )}
            >
              {s3TestResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              )}
              <span>{s3TestResult.message}</span>
            </div>
          )}

          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Display name (e.g., My R2 Bucket)" value={s3Form.name} onChange={(event) => setS3Form({ ...s3Form, name: event.target.value })} required />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Bucket name" value={s3Form.bucket} onChange={(event) => setS3Form({ ...s3Form, bucket: event.target.value })} required />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Region (e.g., us-east-1, auto)" value={s3Form.region} onChange={(event) => setS3Form({ ...s3Form, region: event.target.value })} required />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Endpoint URL (e.g., https://<account_id>.r2.cloudflarestorage.com)" value={s3Form.endpoint} onChange={(event) => setS3Form({ ...s3Form, endpoint: event.target.value })} />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Access key ID" value={s3Form.accessKeyId} onChange={(event) => setS3Form({ ...s3Form, accessKeyId: event.target.value })} required />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Secret access key" type="password" value={s3Form.secretAccessKey} onChange={(event) => setS3Form({ ...s3Form, secretAccessKey: event.target.value })} required />
          <input className="h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] px-3 text-sm focus:border-[var(--accent)] outline-none" placeholder="Quota bytes (optional)" inputMode="numeric" value={s3Form.quotaBytes} onChange={(event) => setS3Form({ ...s3Form, quotaBytes: event.target.value })} />
          <label className="flex items-center gap-2 text-sm font-semibold select-none cursor-pointer"><input type="checkbox" checked={s3Form.forcePathStyle} onChange={(event) => setS3Form({ ...s3Form, forcePathStyle: event.target.checked })} />Force path style (required for MinIO)</label>
          <div className="grid gap-2 sm:flex sm:justify-end">
            <Button variant="outline" type="button" onClick={() => { setS3Open(false); setS3TestResult(null) }} disabled={connectingS3 || testingS3}>
              Cancel
            </Button>
            <Button variant="outline" type="button" onClick={testS3} disabled={testingS3 || connectingS3} className="gap-1.5 font-bold">
              <RefreshCw className={cn("h-4 w-4", testingS3 && "animate-spin")} />
              {testingS3 ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button type="submit" disabled={connectingS3 || testingS3} className="font-bold">
              {connectingS3 ? 'Connecting...' : 'Connect S3'}
            </Button>
          </div>
        </form>
      </DummyModal>
      <DummyModal open={Boolean(accountToDisconnect)} title="Disconnect storage?" description="This will remove this storage account from Better Drive. Existing file records for this account may no longer be usable." onClose={() => setAccountToDisconnect(null)}>
        <div className="grid gap-4">
          <div className="rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 text-sm text-[var(--app-text-muted)]">
            <p className="font-semibold text-[var(--app-text)]">{accountToDisconnect?.email}</p>
            <p className="mt-1">Used storage: {formatBytes(accountToDisconnect?.storageAccount?.usedBytes)}</p>
          </div>
          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button variant="outline" onClick={() => setAccountToDisconnect(null)} disabled={Boolean(disconnectingAccountId)}>Cancel</Button>
            <Button variant="danger" onClick={disconnect} disabled={Boolean(disconnectingAccountId)}><Trash2 className="h-4 w-4" />{disconnectingAccountId ? 'Disconnecting...' : 'Disconnect'}</Button>
          </div>
        </div>
      </DummyModal>
      <AvatarPickerModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        user={user}
        currentAvatarUrl={profileImageUrl}
        onAvatarChanged={(newUrl) => {
          setProfileImageUrl(newUrl)
          setAvatarError(false)
        }}
      />
    </>
  )
}
