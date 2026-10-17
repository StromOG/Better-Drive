import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  KeyRound,
  Link2,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DummyModal } from '@/components/drive/DummyModal'
import { AccountCard, type ConnectedAccountData } from '@/components/settings/AccountCard'
import { apiFetch, formatBytes } from '@/lib/api'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

interface S3Preset {
  name: string
  label: string
  defaultRegion: string
  defaultEndpoint: string
  forcePathStyle?: boolean
}

const S3_PRESETS: S3Preset[] = [
  { name: 'aws', label: 'AWS S3', defaultRegion: 'us-east-1', defaultEndpoint: '' },
  { name: 'r2', label: 'Cloudflare R2', defaultRegion: 'auto', defaultEndpoint: 'https://<accountid>.r2.cloudflarestorage.com' },
  { name: 'minio', label: 'MinIO', defaultRegion: 'us-east-1', defaultEndpoint: 'http://127.0.0.1:9000', forcePathStyle: true },
  { name: 'b2', label: 'Backblaze B2', defaultRegion: 'us-east-005', defaultEndpoint: 'https://s3.us-east-005.backblazeb2.com' },
  { name: 'wasabi', label: 'Wasabi', defaultRegion: 'us-east-1', defaultEndpoint: 'https://s3.wasabisys.com' },
]

export function AccountsPage() {
  const { notify } = useNotifications()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'providers' | 'guide' | 'terminal' | 'map') || 'providers'
  const initialProvider = (searchParams.get('provider') as 'google' | 'r2' | 'minio' | 'aws' | 'b2' | 'wasabi' | 'policy') || 'google'

  const [accounts, setAccounts] = useState<ConnectedAccountData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [hubTab, setHubTab] = useState<'providers' | 'guide' | 'terminal' | 'map'>(initialTab)
  const [guideProvider, setGuideProvider] = useState<'google' | 'r2' | 'minio' | 'aws' | 'b2' | 'wasabi' | 'policy'>(initialProvider)
  const [terminalTab, setTerminalTab] = useState<'env' | 'pwsh' | 'bash' | 'curl' | 's3cli' | 'rclone'>('env')
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null)

  // S3 modal & form
  const [s3Open, setS3Open] = useState(false)
  const [connectingS3, setConnectingS3] = useState(false)
  const [testingS3, setTestingS3] = useState(false)
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [s3Form, setS3Form] = useState({
    name: '',
    bucket: '',
    region: 'us-east-1',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    forcePathStyle: false,
    quotaBytes: '',
  })

  // Google OAuth Config states
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleRedirectUri, setGoogleRedirectUri] = useState('')
  const [defaultRedirectUri, setDefaultRedirectUri] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [savingGoogleConfig, setSavingGoogleConfig] = useState(false)

  // Disconnect modal state
  const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAccountData | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

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

  const fetchAccounts = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ accounts: ConnectedAccountData[] }>('/connected-accounts')
      setAccounts(data.accounts || [])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGoogleConfig = async () => {
    try {
      const config = await apiFetch<{
        configured: boolean
        clientId: string
        redirectUri: string
        defaultRedirectUri: string
        hasClientSecret: boolean
      }>('/system/google-config')
      if (config) {
        setGoogleClientId(config.clientId || '')
        setGoogleRedirectUri(config.redirectUri || '')
        setDefaultRedirectUri(config.defaultRedirectUri || '')
        setHasSecret(config.hasClientSecret)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchAccounts()
    fetchGoogleConfig()
  }, [])

  const handleRename = async (id: string, label: string) => {
    await apiFetch(`/system/connected-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    })
    await fetchAccounts()
    notify.success('Account Renamed', 'Display label updated.', { category: 'storage' })
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await apiFetch(`/system/connected-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
    await fetchAccounts()
    notify.info(
      enabled ? 'Account Enabled' : 'Account Suspended',
      `Storage account ${enabled ? 'reactivated' : 'temporarily suspended'}.`,
      { category: 'storage' }
    )
  }

  const handleReauth = async (id: string) => {
    try {
      await apiFetch(`/system/connected-accounts/${id}/reauth`, {
        method: 'POST',
      })
      await fetchAccounts()
    } catch {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url').catch(() => null)
      if (data?.url) {
        window.location.href = data.url
      }
    }
  }

  const handleDisconnect = async (id: string) => {
    const acc = accounts.find((a) => a.id === id)
    if (acc) {
      setAccountToDisconnect(acc)
    }
  }

  const confirmDisconnect = async () => {
    if (!accountToDisconnect) return
    setDisconnecting(true)
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, { method: 'DELETE' })
      notify.info('Storage Disconnected', `Account ${accountToDisconnect.email} removed.`, { category: 'storage' })
      await fetchAccounts()
      setAccountToDisconnect(null)
      window.dispatchEvent(new Event('betterdrive:storage-changed'))
    } catch (err: any) {
      notify.error('Disconnect Failed', err?.message || 'Could not disconnect account', { category: 'storage' })
    } finally {
      setDisconnecting(false)
    }
  }

  const connectGoogleDrive = async () => {
    setConnecting(true)
    try {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url')
      window.location.href = data.url
    } catch (err: any) {
      notify.error('Google OAuth Error', err?.message || 'Could not initiate connection.', { category: 'storage' })
      setConnecting(false)
    }
  }

  const testS3 = async () => {
    setTestingS3(true)
    setS3TestResult(null)
    try {
      const res = await apiFetch<{ success: boolean; message: string; bucket?: string; region?: string }>(
        '/connected-accounts/s3/test',
        {
          method: 'POST',
          body: JSON.stringify({
            ...s3Form,
            endpoint: s3Form.endpoint || undefined,
            quotaBytes: s3Form.quotaBytes || null,
          }),
        }
      )
      setS3TestResult(res)
    } catch (err: any) {
      setS3TestResult({ success: false, message: err?.message || 'Connection test failed.' })
    } finally {
      setTestingS3(false)
    }
  }

  const connectS3 = async (e: FormEvent) => {
    e.preventDefault()
    setConnectingS3(true)
    try {
      await apiFetch('/connected-accounts/s3', {
        method: 'POST',
        body: JSON.stringify({
          ...s3Form,
          endpoint: s3Form.endpoint || undefined,
          quotaBytes: s3Form.quotaBytes || null,
        }),
      })
      notify.success('S3 Storage Connected', `Bucket "${s3Form.bucket}" connected successfully.`, { category: 'storage' })
      setS3Open(false)
      setS3Form({
        name: '',
        bucket: '',
        region: 'us-east-1',
        endpoint: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
        quotaBytes: '',
      })
      await fetchAccounts()
      window.dispatchEvent(new Event('betterdrive:storage-changed'))
    } catch (err: any) {
      notify.error('S3 Connection Failed', err?.message || 'Failed to connect S3 storage.', { category: 'storage' })
    } finally {
      setConnectingS3(false)
    }
  }

  const saveGoogleConfig = async (e: FormEvent) => {
    e.preventDefault()
    setSavingGoogleConfig(true)
    try {
      const res = await apiFetch<{ message: string }>('/system/google-config', {
        method: 'POST',
        body: JSON.stringify({
          clientId: googleClientId,
          clientSecret: googleClientSecret || undefined,
          redirectUri: googleRedirectUri || defaultRedirectUri,
        }),
      })
      notify.success('Google OAuth Saved', res.message || 'Credentials updated successfully.', { category: 'security' })
      setHasSecret(true)
      setGoogleClientSecret('')
    } catch (err: any) {
      notify.error('Failed to Save', err?.message || 'Could not update Google credentials.', { category: 'security' })
    } finally {
      setSavingGoogleConfig(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. Quick Storage Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Pooled Storage</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">
              {accounts.length} connected {accounts.length === 1 ? 'account' : 'accounts'}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">AES-256-GCM Vault</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Zero-Trust Tokens Active</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Storage Gateway</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Port 2222 SFTP Online</p>
          </div>
        </Card>
      </div>

      {/* 2. Cloud Storage & Virtual Drive Hub with Setup Guides, Terminal, and Architecture Map */}
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
                    Multi-Cloud
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
                { id: 'guide', label: 'Setup Guides', icon: KeyRound },
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
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer',
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* TAB 1: CLOUD PROVIDERS PRESETS */}
          {hubTab === 'providers' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Google Drive Card */}
                <div className="flex flex-col justify-between p-4 rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-sm text-[var(--app-text)]">
                        <Cloud className="h-4 w-4 text-blue-600" />
                        <span>Google Drive</span>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                          hasSecret || googleClientId
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        )}
                      >
                        {hasSecret || googleClientId ? 'OAuth Ready' : 'Needs Config'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                      15 GB free per account. Connect multiple accounts for unlimited aggregate pooling.
                    </p>
                  </div>
                  <div className="mt-3.5">
                    <Button
                      size="sm"
                      onClick={connectGoogleDrive}
                      disabled={connecting}
                      className="w-full text-xs font-bold"
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      {connecting ? 'Connecting...' : 'Connect Google Drive'}
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
                        Zero Egress
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                      S3-compatible object storage with no download fees and generous 10GB free tier.
                    </p>
                  </div>
                  <div className="mt-3.5">
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
                      className="w-full text-xs font-bold cursor-pointer"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                      <span>Connect Cloudflare R2</span>
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
                        100% On-Prem
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[var(--app-text-muted)] leading-relaxed">
                      Connect private home NAS or Docker MinIO with path-style S3 compatibility.
                    </p>
                  </div>
                  <div className="mt-3.5">
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
                      className="w-full text-xs font-bold cursor-pointer"
                    >
                      <HardDrive className="h-3.5 w-3.5 text-rose-500 mr-1.5" />
                      <span>Connect Local MinIO</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Enterprise S3 Compatible Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/5 dark:bg-white/5 p-4 border border-[var(--card-border)] text-xs">
                <div>
                  <span className="font-bold text-[var(--app-text)] block text-sm">
                    Enterprise Object Storage (AWS S3, Wasabi, Backblaze B2, Ceph, SeaweedFS)
                  </span>
                  <p className="text-[var(--app-text-muted)] font-medium mt-0.5">
                    Connect any S3-compatible cloud bucket or private storage cluster with custom endpoints and credentials.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setS3TestResult(null)
                    setS3Open(true)
                  }}
                  className="text-xs font-bold gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add S3 Compatible Bucket</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: COMPREHENSIVE SETUP GUIDES HUB */}
          {hubTab === 'guide' && (
            <div className="space-y-5">
              {/* Provider Selector Segmented Bar — Balanced Orientation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 border-b border-[var(--card-border)] pb-3.5">
                {[
                  { id: 'google', label: 'Google Drive OAuth', icon: Cloud, color: 'text-blue-500' },
                  { id: 'r2', label: 'Cloudflare R2', icon: Database, color: 'text-amber-500' },
                  { id: 'minio', label: 'MinIO NAS / Docker', icon: HardDrive, color: 'text-rose-500' },
                  { id: 'aws', label: 'AWS S3 Enterprise', icon: Database, color: 'text-sky-500' },
                  { id: 'b2', label: 'Backblaze B2', icon: Database, color: 'text-emerald-500' },
                  { id: 'wasabi', label: 'Wasabi Hot Storage', icon: Database, color: 'text-indigo-500' },
                  { id: 'policy', label: 'Bucket Policy & CORS', icon: ShieldCheck, color: 'text-teal-500' },
                ].map((p) => {
                  const Icon = p.icon
                  const isActive = guideProvider === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setGuideProvider(p.id as any)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none ring-0 w-full text-center',
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-0 outline-none border border-blue-600'
                          : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 outline-none'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-white' : p.color)} />
                      <span className="truncate whitespace-nowrap">{p.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* GUIDE 1: GOOGLE DRIVE OAUTH 2.0 PKCE */}
              {guideProvider === 'google' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                          <Cloud className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Google Drive OAuth 2.0 PKCE Setup
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            Link unlimited personal Google accounts into your aggregate virtual storage pool with automatic load balancing.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                          15 GB Free / Account
                        </span>
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          OAuth 2.0 PKCE + Refresh Tokens
                        </span>
                        <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-extrabold text-purple-600 dark:text-purple-400">
                          Aggregate Multi-Account Pool
                        </span>
                      </div>
                    </div>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-sm text-xs cursor-pointer"
                    >
                      <span>Google Cloud Console</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Step-by-Step Procedure */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black">1</span>
                        <span className="font-extrabold text-[var(--app-text)]">Enable Drive API</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Create a project in Google Cloud Console (e.g. <strong>BetterDrive</strong>). Navigate to <strong>APIs & Services → Library</strong>, search for <strong>Google Drive API</strong>, and click <strong>Enable</strong>.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black">2</span>
                        <span className="font-extrabold text-[var(--app-text)]">OAuth Consent Screen</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Select <strong>External</strong> user type. Under <strong>Test Users</strong>, add your personal Gmail address(es) to bypass the Google App Verification review requirement.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black">3</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create Credentials</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Go to <strong>Credentials → Create Credentials → OAuth client ID</strong>. Choose <strong>Web application</strong> and paste the callback URIs listed below into Authorized Redirect URIs.
                      </p>
                    </div>
                  </div>

                  {/* Callback URIs Terminal Box */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                          <Cloud className="h-3.5 w-3.5 text-blue-400" />
                          Authorized Redirect URIs (Required by Google)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const storageUri = defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`
                          const authUri = `${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`
                          copySnippet(`${storageUri}\n${authUri}`, 'both-uris')
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'both-uris' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'both-uris' ? 'Copied Both URIs!' : 'Copy Both URIs'}</span>
                      </button>
                    </div>

                    <div className="p-3.5 space-y-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                        <div className="truncate">
                          <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">Primary Storage Quota Callback:</span>
                          <span className="select-all text-slate-200 font-semibold">
                            {defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copySnippet(defaultRedirectUri || `${window.location.protocol}//${window.location.hostname}:4000/connected-accounts/google/callback`, 'storage-uri')}
                          className="shrink-0 text-[10px] h-7 px-2.5 font-bold cursor-pointer"
                        >
                          {copiedSnippetKey === 'storage-uri' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          Copy Storage URI
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                        <div className="truncate">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">1-Click Google Sign-In Callback:</span>
                          <span className="select-all text-slate-200 font-semibold">
                            {`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copySnippet(`${window.location.protocol}//${window.location.hostname}:4000/auth/google/callback`, 'auth-uri')}
                          className="shrink-0 text-[10px] h-7 px-2.5 font-bold cursor-pointer"
                        >
                          {copiedSnippetKey === 'auth-uri' ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          Copy Login URI
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Pro-Tips & Common Errors */}
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                    <span className="font-extrabold text-[var(--app-text)] block">
                      Troubleshooting Pro-Tips:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                      <li><strong>Error 403: access_denied:</strong> Your Google Cloud project is in Testing mode. Ensure your Google email address is added under <strong>OAuth consent screen → Test users</strong>.</li>
                      <li><strong>Error 400: redirect_uri_mismatch:</strong> The redirect URI in Google Console must match your local server address (including protocol <code className="font-mono">http://</code> and port <code className="font-mono">:4000</code>).</li>
                      <li><strong>Drive Scope:</strong> Better Drive requests <code className="font-mono text-blue-500">drive.file</code> permissions, which only accesses files uploaded through Better Drive for maximum security.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* GUIDE 2: CLOUDFLARE R2 */}
              {guideProvider === 'r2' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                          <Database className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Cloudflare R2 Object Storage
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            High performance S3-compatible cloud storage with zero egress bandwidth charges.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                          10 GB Free Monthly
                        </span>
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          $0 Egress Download Fees
                        </span>
                        <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                          Full S3 API Compatibility
                        </span>
                      </div>
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
                      className="text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span>Configure R2 Bucket</span>
                    </Button>
                  </div>

                  {/* Step-by-Step Procedure */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-black">1</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create Bucket</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        In Cloudflare Dashboard, navigate to <strong>R2 Object Storage → Create bucket</strong> (e.g. <code className="text-amber-500 font-bold">betterdrive-vault</code>). Location hint: <strong>Automatic</strong>.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-black">2</span>
                        <span className="font-extrabold text-[var(--app-text)]">Generate API Token</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Go to <strong>R2 → Manage R2 API Tokens → Create API Token</strong>. Set permissions to <strong>Object Read & Write</strong> and apply to your new bucket. Set TTL to <strong>Forever</strong>.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-black">3</span>
                        <span className="font-extrabold text-[var(--app-text)]">Extract Endpoint</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Copy your <strong>Account ID</strong> from your Cloudflare dashboard URL. Your S3 endpoint is: <code className="text-amber-500 select-all font-bold">https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</code>.
                      </p>
                    </div>
                  </div>

                  {/* Rclone & CLI Tooling Snippet */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5 text-amber-400" />
                          rclone.conf — Cloudflare R2 Remote
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copySnippet(`[r2]\ntype = s3\nprovider = Cloudflare\naccess_key_id = <YOUR_ACCESS_KEY_ID>\nsecret_access_key = <YOUR_SECRET_ACCESS_KEY>\nendpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com\nacl = private`, 'r2-rclone')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'r2-rclone' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'r2-rclone' ? 'Copied Config!' : 'Copy rclone.conf'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11.5px] text-amber-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`[r2]
type = s3
provider = Cloudflare
access_key_id = <YOUR_ACCESS_KEY_ID>
secret_access_key = <YOUR_SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
acl = private`}
                    </pre>
                  </div>
                </div>
              )}

              {/* GUIDE 3: MINIO LOCAL NAS */}
              {guideProvider === 'minio' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                          <HardDrive className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Local MinIO & Home NAS Private Storage
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            100% self-hosted, private local storage with path-style S3 compatibility.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                          Unlimited Local Terabytes
                        </span>
                        <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          100% On-Prem Air-Gapped
                        </span>
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          Docker & TrueNAS Ready
                        </span>
                      </div>
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
                      className="text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-rose-300" />
                      <span>Configure MinIO Connection</span>
                    </Button>
                  </div>

                  {/* Key Architecture Requirement */}
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-1">
                    <span className="font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      Critical Requirement: Force Path Style
                    </span>
                    <p className="text-[11px] text-[var(--app-text-muted)] leading-relaxed">
                      Local IP addresses and hostnames (<code className="font-mono">localhost</code>, <code className="font-mono">192.168.x.x</code>) do not support DNS wildcard subdomains. You <strong>MUST</strong> enable <strong>Force Path Style</strong> (<code className="font-mono">http://localhost:9000/bucket</code> instead of <code className="font-mono">http://bucket.localhost:9000</code>). Better Drive enables this automatically when using the MinIO preset.
                    </p>
                  </div>

                  {/* Docker One-Liner Terminal Box */}
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
                          Docker Run One-Liner (Self-Host in 10 Seconds)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copySnippet(`docker run -d -p 9000:9000 -p 9001:9001 --name minio-betterdrive -v ~/minio-data:/data -e "MINIO_ROOT_USER=minioadmin" -e "MINIO_ROOT_PASSWORD=minioadmin" quay.io/minio/minio server /data --console-address ":9001"`, 'minio-cmd')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'minio-cmd' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'minio-cmd' ? 'Copied Command!' : 'Copy Docker Run'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11.5px] text-rose-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`docker run -d -p 9000:9000 -p 9001:9001 --name minio-betterdrive \\
  -v ~/minio-data:/data \\
  -e "MINIO_ROOT_USER=minioadmin" \\
  -e "MINIO_ROOT_PASSWORD=minioadmin" \\
  quay.io/minio/minio server /data --console-address ":9001"`}
                    </pre>

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
                        <span className="text-slate-400 font-semibold">Default Port:</span>
                        <code className="text-rose-300 font-bold select-all">9000 (API)</code>
                      </div>
                    </div>
                  </div>

                  {/* Docker Compose YAML Box */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                        docker-compose.yml (Production Ready with Healthchecks)
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`version: '3.8'\nservices:\n  minio:\n    image: quay.io/minio/minio:latest\n    container_name: minio-betterdrive\n    ports:\n      - "9000:9000"\n      - "9001:9001"\n    environment:\n      MINIO_ROOT_USER: minioadmin\n      MINIO_ROOT_PASSWORD: minioadmin_secure_password\n    volumes:\n      - minio_storage:/data\n    command: server /data --console-address ":9001"\n    restart: unless-stopped\nvolumes:\n  minio_storage:`, 'minio-compose')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'minio-compose' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'minio-compose' ? 'Copied YAML!' : 'Copy Compose YAML'}</span>
                      </button>
                    </div>
                    <pre className="p-4 font-mono text-[11px] text-indigo-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`version: '3.8'
services:
  minio:
    image: quay.io/minio/minio:latest
    container_name: minio-betterdrive
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin_secure_password
    volumes:
      - minio_storage:/data
    command: server /data --console-address ":9001"
    restart: unless-stopped
volumes:
  minio_storage:`}
                    </pre>
                  </div>
                </div>
              )}

              {/* GUIDE 4: AWS S3 ENTERPRISE */}
              {guideProvider === 'aws' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
                          <Database className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Amazon Web Services (AWS S3) Setup
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            Enterprise high-availability cloud object storage with granular IAM policies.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-600 dark:text-sky-400">
                          99.999999999% (11 9's) Durability
                        </span>
                        <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                          Multi-Region Availability
                        </span>
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          Granular IAM Policy Protection
                        </span>
                      </div>
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
                      className="text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                      <span>Configure AWS S3 Bucket</span>
                    </Button>
                  </div>

                  {/* 3 Steps Walkthrough */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-black">1</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create Private Bucket</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        In AWS S3 Console, click <strong>Create bucket</strong> (e.g. <code className="text-sky-500 font-bold">betterdrive-vault</code>). Keep <strong>Block all public access</strong> ON. Enable default SSE-S3 encryption.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-black">2</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create IAM User</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        In IAM Console, create a programmatic service user (e.g. <code className="text-sky-500 font-bold">betterdrive-app</code>). Under <strong>Security credentials</strong>, create an Access Key for an application outside AWS.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-black">3</span>
                        <span className="font-extrabold text-[var(--app-text)]">Attach IAM Policy</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Attach the least-privilege JSON policy shown in the <strong>Bucket Policy & CORS</strong> tab to restrict permissions exclusively to your designated storage bucket.
                      </p>
                    </div>
                  </div>

                  {/* Regional Endpoints Table */}
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-2">
                    <span className="font-bold text-[var(--app-text)] block">
                      Common AWS S3 Regions & Endpoint Formats:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block">US East (N. Virginia):</span>
                        <code className="text-sky-600 dark:text-sky-400 font-bold">us-east-1</code>
                      </div>
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block">US West (Oregon):</span>
                        <code className="text-sky-600 dark:text-sky-400 font-bold">us-west-2</code>
                      </div>
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block">Europe (Frankfurt):</span>
                        <code className="text-sky-600 dark:text-sky-400 font-bold">eu-central-1</code>
                      </div>
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block">Asia (Singapore):</span>
                        <code className="text-sky-600 dark:text-sky-400 font-bold">ap-southeast-1</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GUIDE 5: BACKBLAZE B2 */}
              {guideProvider === 'b2' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                          <Database className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Backblaze B2 Cloud Storage Setup
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            Cost-effective cloud backup and media archiving at 1/4th the price of standard AWS S3.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          $0.005 / GB-Month (78% Cheaper)
                        </span>
                        <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                          10 GB Free Storage
                        </span>
                        <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-extrabold text-purple-600 dark:text-purple-400">
                          Free Egress up to 3x Stored Data
                        </span>
                      </div>
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
                      className="text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                      <span>Configure Backblaze B2</span>
                    </Button>
                  </div>

                  {/* Step-by-Step Procedure */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">1</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create Private Bucket</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        In Backblaze B2, navigate to <strong>Buckets → Create a Bucket</strong>. Set files to <strong>Private</strong> and keep Default Encryption enabled.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">2</span>
                        <span className="font-extrabold text-[var(--app-text)]">Create Application Key</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        Under <strong>App Keys → Add a New Application Key</strong>, restrict access to your new bucket and select <strong>Read and Write</strong> permissions.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">3</span>
                        <span className="font-extrabold text-[var(--app-text)]">Find S3 Endpoint</span>
                      </div>
                      <p className="text-[var(--app-text-muted)] text-[11px] leading-relaxed">
                        On your Bucket Details card, note your S3 endpoint (e.g. <code className="text-emerald-500 font-bold select-all">https://s3.us-west-004.backblazeb2.com</code>). The region is the prefix before <code className="font-mono">.backblazeb2.com</code>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* GUIDE 6: WASABI HOT STORAGE */}
              {guideProvider === 'wasabi' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                          <Database className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            Wasabi Hot Cloud Storage Setup
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            Predictable, blazing fast cloud storage with zero egress fees and zero API request charges.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          $6.99 / TB-Month Flat
                        </span>
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          Zero Egress Bandwidth Fees
                        </span>
                        <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                          Zero API Request Charges
                        </span>
                      </div>
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
                      className="text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                      <span>Configure Wasabi Connection</span>
                    </Button>
                  </div>

                  {/* Wasabi Endpoints Matrix */}
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 space-y-2">
                    <span className="font-bold text-[var(--app-text)] block">
                      Wasabi Region Endpoints:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block mb-0.5">US East 1 (N. Virginia):</span>
                        <code className="text-indigo-600 dark:text-indigo-400 font-bold select-all">https://s3.wasabisys.com</code>
                      </div>
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block mb-0.5">US West 1 (Oregon):</span>
                        <code className="text-indigo-600 dark:text-indigo-400 font-bold select-all">https://s3.us-west-1.wasabisys.com</code>
                      </div>
                      <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2.5 border border-[var(--card-border)]">
                        <span className="text-[10px] font-bold text-[var(--app-text-muted)] block mb-0.5">EU Central 1 (Amsterdam):</span>
                        <code className="text-indigo-600 dark:text-indigo-400 font-bold select-all">https://s3.eu-central-1.wasabisys.com</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GUIDE 7: BUCKET POLICY & CORS HUB */}
              {guideProvider === 'policy' && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-5 space-y-4 text-xs">
                  {/* Hero Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-500">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-[var(--app-text)]">
                            IAM Policy & Cross-Origin Resource Sharing (CORS)
                          </h3>
                          <p className="text-[11px] text-[var(--app-text-muted)] font-medium">
                            Production-grade least-privilege access rules and browser upload permissions for AWS, R2, Wasabi, and MinIO.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          Least-Privilege Security
                        </span>
                        <span className="rounded-md bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-[10px] font-extrabold text-teal-600 dark:text-teal-400">
                          Multi-Cloud CORS Spec
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Production Least-Privilege IAM Policy JSON */}
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
                          iam-policy.json (Least-Privilege S3 Policy)
                        </span>
                      </div>
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
                              "s3:DeleteObject"
                            ],
                            Resource: ["arn:aws:s3:::betterdrive-vault", "arn:aws:s3:::betterdrive-vault/*"]
                          }]
                        }, null, 2), 'iam-policy')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'iam-policy' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'iam-policy' ? 'Copied Policy!' : 'Copy IAM Policy'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
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
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::betterdrive-vault",
        "arn:aws:s3:::betterdrive-vault/*"
      ]
    }
  ]
}`}
                    </pre>
                  </div>

                  {/* Production CORS JSON */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-teal-400" />
                          cors-configuration.json (Browser Upload Permissions)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copySnippet(JSON.stringify([{
                          AllowedHeaders: ["*"],
                          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                          AllowedOrigins: ["*"],
                          ExposeHeaders: ["ETag"],
                          MaxAgeSeconds: 3000
                        }], null, 2), 'cors-json')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'cors-json' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'cors-json' ? 'Copied CORS!' : 'Copy CORS JSON'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-teal-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]`}
                    </pre>

                    <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-800/60 text-[11px] text-slate-300 space-y-1">
                      <span className="font-bold text-white block">Where to paste this in AWS / Cloudflare:</span>
                      <p className="text-slate-400">
                        • <strong>AWS S3:</strong> Bucket Details → Permissions tab → Scroll down to <strong>Cross-origin resource sharing (CORS)</strong> → Edit → Paste.
                      </p>
                      <p className="text-slate-400">
                        • <strong>Cloudflare R2:</strong> R2 Bucket Details → Settings tab → <strong>CORS Policy</strong> → Add CORS Policy → Paste.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TERMINAL & COMMANDS HUB */}
          {hubTab === 'terminal' && (
            <div className="space-y-5 text-xs">
              {/* Category Segmented Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-b border-[var(--card-border)] pb-3.5">
                {[
                  { id: 'env', label: '.env Configuration', icon: KeyRound },
                  { id: 'pwsh', label: 'PowerShell CLI', icon: Terminal },
                  { id: 'bash', label: 'Bash & cURL', icon: Code2 },
                  { id: 's3cli', label: 'AWS S3 CLI', icon: Database },
                  { id: 'rclone', label: 'Rclone Sync & Mount', icon: RefreshCw },
                ].map((t) => {
                  const Icon = t.icon
                  const isActive = terminalTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTerminalTab(t.id as any)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none ring-0 w-full text-center',
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-0 outline-none border border-blue-600'
                          : 'border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5 outline-none'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-white' : 'text-blue-500')} />
                      <span className="truncate whitespace-nowrap">{t.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* COMMAND SUITE 1: .ENV CONFIGURATION */}
              {terminalTab === 'env' && (
                <div className="space-y-4">
                  {/* Hero Description */}
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[var(--app-text)]">
                          Production Environment Variables (.env)
                        </h3>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Full server configuration for encryption keys, SQLite database, JWT tokens, and SFTP port bindings.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copySnippet(`PORT=4000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL="file:./data/betterdrive.db"
BETTERDRIVE_JWT_SECRET="replace_with_64_char_secure_random_hex"
BETTERDRIVE_ENCRYPTION_KEY="replace_with_32_byte_aes_gcm_hex_key"
SESSION_SECRET="betterdrive_session_super_secret_seed"
SFTP_ENABLED=true
SFTP_PORT=2222
SFTP_HOST_KEY_PATH="./data/ssh_host_ed25519_key"
GOOGLE_CLIENT_ID="your_google_cloud_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_cloud_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/v1/auth/google/callback"
MAX_UPLOAD_SIZE_BYTES=107374182400
CHUNK_SIZE_BYTES=5242880`, 'env-file')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-xs text-xs cursor-pointer shrink-0"
                    >
                      {copiedSnippetKey === 'env-file' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedSnippetKey === 'env-file' ? 'Copied .env!' : 'Copy Entire .env'}</span>
                    </button>
                  </div>

                  {/* Terminal Box */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11.5px] font-mono font-bold text-slate-300 pl-1.5 flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                          .env (Better Drive Gateway Configuration)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        UTF-8 Clean
                      </span>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-emerald-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# ==============================================================================
# BETTER DRIVE HIGH-PERFORMANCE MULTI-CLOUD GATEWAY
# Save this file to backend/.env or your deployment working directory
# ==============================================================================

# Network & Server Binding
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# Embedded High-Speed SQLite Database Engine
DATABASE_URL="file:./data/betterdrive.db"

# Core Cryptographic Secrets (AES-256-GCM & Session Security)
# Generate with: openssl rand -hex 32
BETTERDRIVE_JWT_SECRET="d8e5f2a1b9c47e80f2d4e6a8b1c3e5a7d9f1e3c5a7b9d1e3f5a7b9c1d3e5f7a9"
BETTERDRIVE_ENCRYPTION_KEY="f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
SESSION_SECRET="betterdrive_session_vault_super_secret_seed"

# Termius SFTP Gateway (Port 2222 with SSH Ed25519 Host Key)
SFTP_ENABLED=true
SFTP_PORT=2222
SFTP_HOST_KEY_PATH="./data/ssh_host_ed25519_key"

# Google Drive Cloud OAuth 2.0 PKCE Credentials
GOOGLE_CLIENT_ID="109876543210-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your_google_cloud_client_secret_here"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/v1/auth/google/callback"

# Chunking & Streaming Controls
MAX_UPLOAD_SIZE_BYTES=107374182400     # 100 GB per single file
CHUNK_SIZE_BYTES=5242880                 # 5 MB resumable streaming chunks`}
                    </pre>

                    {/* Explanatory Grid */}
                    <div className="p-4 bg-slate-900/60 border-t border-slate-800/80 grid gap-3 sm:grid-cols-3 text-[11px]">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <strong className="text-white block font-bold mb-1">🔐 AES-256 Encryption</strong>
                        <p className="text-slate-400 leading-relaxed">
                          <code className="text-blue-300 font-mono">BETTERDRIVE_ENCRYPTION_KEY</code> encrypts connected account OAuth refresh tokens, S3 secret access keys, and passwords at rest in SQLite.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <strong className="text-white block font-bold mb-1">🖥️ SFTP Gateway (Port 2222)</strong>
                        <p className="text-slate-400 leading-relaxed">
                          <code className="text-blue-300 font-mono">SFTP_PORT=2222</code> runs a standalone lightweight SSH daemon that allows Termius, FileZilla, and Cyberduck to mount your unified cloud pool.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                        <strong className="text-white block font-bold mb-1">🎲 Generate Random Keys</strong>
                        <p className="text-slate-400 leading-relaxed">
                          Run <code className="text-amber-300 font-mono">openssl rand -hex 32</code> in PowerShell or Bash to generate cryptographically safe 256-bit random hex strings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMMAND SUITE 2: POWERSHELL CLI */}
              {terminalTab === 'pwsh' && (
                <div className="space-y-4">
                  {/* Hero Description */}
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Terminal className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[var(--app-text)]">
                          Windows PowerShell CLI Automation
                        </h3>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Native PowerShell commands using <code className="font-mono">Invoke-RestMethod</code> for uploading files, listing accounts, and querying quota.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[11px] border border-blue-500/20">
                      PowerShell 5.1 & 7+
                    </span>
                  </div>

                  {/* Command 1: Upload File */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">1</span>
                        Upload File with Progress & Auth Token
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`$headers = @{ "Authorization" = "Bearer bd_live_your_api_key_here" }
$filePath = "C:\\backups\\database_snapshot.zip"
$form = @{
  file = Get-Item -Path $filePath
  folderId = "" # Optional virtual folder UUID
}
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/uploads" -Method Post -Headers $headers -Form $form`, 'pwsh-upload')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'pwsh-upload' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'pwsh-upload' ? 'Copied!' : 'Copy Script'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-cyan-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# 1. Define Authentication Headers
$headers = @{
  "Authorization" = "Bearer bd_live_your_api_key_here"
}

# 2. Select Local File to Stream
$filePath = "C:\\backups\\database_snapshot.zip"
$form = @{
  file = Get-Item -Path $filePath
  folderId = "" # Optional virtual folder UUID (leave blank for root)
}

# 3. Stream File via Multipart Form
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/uploads" -Method Post -Headers $headers -Form $form
Write-Host "Uploaded: $($response.file.name) (SHA-256: $($response.file.checksum))" -ForegroundColor Green`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Use Case:</strong> Perfect for Windows Task Scheduler backup scripts that automatically archive SQL databases or VM snapshots to Better Drive.
                    </div>
                  </div>

                  {/* Command 2: Query Quota & Cloud Health */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
                        Query Storage Capacity & Connected Account Status
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`$headers = @{ "Authorization" = "Bearer bd_live_your_api_key_here" }
$quota = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/storage/quota" -Headers $headers
$accounts = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/connected-accounts" -Headers $headers

Write-Host "=== BETTER DRIVE POOL TELEMETRY ===" -ForegroundColor Cyan
Write-Host "Total Pooled Quota: $([math]::Round($quota.totalBytes / 1GB, 2)) GB"
Write-Host "Used Storage:       $([math]::Round($quota.usedBytes / 1GB, 2)) GB ($([math]::Round($quota.usedBytes / $quota.totalBytes * 100, 1))%)"
Write-Host "Active Accounts:    $($accounts.accounts.Count) connected provider(s)"`, 'pwsh-quota')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'pwsh-quota' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'pwsh-quota' ? 'Copied!' : 'Copy Script'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-cyan-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`$headers = @{ "Authorization" = "Bearer bd_live_your_api_key_here" }
$quota = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/storage/quota" -Headers $headers
$accounts = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/connected-accounts" -Headers $headers

Write-Host "=== BETTER DRIVE POOL TELEMETRY ===" -ForegroundColor Cyan
Write-Host "Total Pooled Quota: $([math]::Round($quota.totalBytes / 1GB, 2)) GB"
Write-Host "Used Storage:       $([math]::Round($quota.usedBytes / 1GB, 2)) GB ($([math]::Round($quota.usedBytes / $quota.totalBytes * 100, 1))%)"
Write-Host "Active Accounts:    $($accounts.accounts.Count) connected provider(s)"`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Use Case:</strong> Use this snippet in server monitoring systems (PRTG, Datadog, Zabbix) to alert when your pooled storage exceeds 85%.
                    </div>
                  </div>
                </div>
              )}

              {/* COMMAND SUITE 3: BASH & CURL */}
              {terminalTab === 'bash' && (
                <div className="space-y-4">
                  {/* Hero Description */}
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[var(--app-text)]">
                          Bash & cURL REST API Streaming
                        </h3>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Standard POSIX cURL commands for Linux servers, macOS, Docker containers, and CI/CD pipelines.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                      Zero Dependencies
                    </span>
                  </div>

                  {/* Command 1: Upload with Pre-Hash */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">1</span>
                        Streaming Upload with Bearer Authentication
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`curl -X POST "http://localhost:4000/api/v1/uploads" \\
  -H "Authorization: Bearer bd_live_your_api_key_here" \\
  -F "file=@/path/to/archive.tar.gz" \\
  -F "folderId=optional_folder_uuid"`, 'curl-upload')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'curl-upload' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'curl-upload' ? 'Copied!' : 'Copy cURL'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-amber-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Upload file directly to Better Drive
curl -X POST "http://localhost:4000/api/v1/uploads" \\
  -H "Authorization: Bearer bd_live_your_api_key_here" \\
  -F "file=@/var/backups/daily_snapshot.tar.gz" \\
  -F "folderId="`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Deduplication Note:</strong> If the file has already been uploaded by any authorized member, the SHA-256 pre-check resolves in 20ms without consuming additional cloud quota.
                    </div>
                  </div>

                  {/* Command 2: Direct Binary Stream Download */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
                        Streaming Download with Original Filename (-O -J)
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`curl -O -J "http://localhost:4000/api/v1/files/FILE_UUID/download" \\
  -H "Authorization: Bearer bd_live_your_api_key_here"`, 'curl-download')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'curl-download' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'curl-download' ? 'Copied!' : 'Copy cURL'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-amber-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Download file stream directly; -O saves with server filename, -J honors Content-Disposition
curl -O -J "http://localhost:4000/api/v1/files/FILE_UUID/download" \\
  -H "Authorization: Bearer bd_live_your_api_key_here"`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Security:</strong> The client never sees the underlying Google Drive access token or private S3 endpoint. All traffic proxies securely through Better Drive.
                    </div>
                  </div>

                  {/* Command 3: Automated Crontab Backup Script */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">3</span>
                        Automated Daily Crontab Backup Template
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`#!/bin/bash
# Crontab: 0 3 * * * /opt/scripts/backup_vault.sh
DATE=$(date +%Y%m%d_%H%M%S)
ARCHIVE="/tmp/backup_\${DATE}.tar.gz"

tar -czf "$ARCHIVE" /data/important_files
curl -s -X POST "http://localhost:4000/api/v1/uploads" \\
  -H "Authorization: Bearer bd_live_your_api_key_here" \\
  -F "file=@$ARCHIVE"
rm -f "$ARCHIVE"`, 'cron-script')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'cron-script' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'cron-script' ? 'Copied!' : 'Copy Shell Script'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-amber-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`#!/usr/bin/env bash
# Add to crontab via: crontab -e
# 0 3 * * * /opt/scripts/backup_to_drive.sh > /var/log/backup.log 2>&1

set -euo pipefail

BACKUP_SRC="/data/production_data"
ARCHIVE="/tmp/vault_backup_$(date +%Y%m%d).tar.gz"
API_URL="http://localhost:4000/api/v1/uploads"
API_KEY="bd_live_your_api_key_here"

echo "Creating compressed tarball..."
tar -czf "$ARCHIVE" "$BACKUP_SRC"

echo "Streaming backup to Better Drive..."
curl -s -X POST "$API_URL" \\
  -H "Authorization: Bearer $API_KEY" \\
  -F "file=@$ARCHIVE"

rm -f "$ARCHIVE"
echo "Backup successfully archived and encrypted."`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Tip:</strong> Create an isolated read-only API Key under <strong>Settings → API Keys</strong> dedicated exclusively to automated backup bots.
                    </div>
                  </div>
                </div>
              )}

              {/* COMMAND SUITE 4: AWS S3 CLI */}
              {terminalTab === 's3cli' && (
                <div className="space-y-4">
                  {/* Hero Description */}
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[var(--app-text)]">
                          AWS S3 CLI & Compatible Cloud Storage
                        </h3>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Inspect, sync, and presign URLs on AWS S3, Cloudflare R2, MinIO, Backblaze B2, and Wasabi buckets directly from terminal.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[11px] border border-sky-500/20">
                      AWS CLI v2
                    </span>
                  </div>

                  {/* Command 1: Direct Bucket Test */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">1</span>
                        Verify Endpoint Connectivity & List Objects
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`aws s3 ls s3://betterdrive-vault/ \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com`, 'aws-ls')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'aws-ls' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'aws-ls' ? 'Copied!' : 'Copy Command'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-sky-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Test Cloudflare R2 or MinIO endpoint connectivity
aws s3 ls s3://betterdrive-vault/ \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>MinIO Local:</strong> For local Docker MinIO instances, use <code className="text-white font-mono">--endpoint-url http://127.0.0.1:9000</code>.
                    </div>
                  </div>

                  {/* Command 2: Bidirectional Sync */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
                        Mirror Local Directory to S3 Bucket with Checksums
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`aws s3 sync /data/documents s3://betterdrive-vault/documents/ \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \\
  --delete`, 'aws-sync')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'aws-sync' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'aws-sync' ? 'Copied!' : 'Copy Command'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-sky-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Mirror local files to remote cloud bucket
aws s3 sync /data/documents s3://betterdrive-vault/documents/ \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \\
  --delete`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Flag Detail:</strong> <code className="text-white font-mono">--delete</code> prunes files on the cloud bucket that have been removed locally, keeping them identical.
                    </div>
                  </div>

                  {/* Command 3: Presigned Download Link */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">3</span>
                        Generate 1-Hour Presigned Direct Download URL
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`aws s3 presign s3://betterdrive-vault/documents/report.pdf \\
  --expires-in 3600 \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com`, 'aws-presign')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'aws-presign' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'aws-presign' ? 'Copied!' : 'Copy Command'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-sky-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Generates temporary HTTP URL valid for 3600 seconds (1 hour)
aws s3 presign s3://betterdrive-vault/documents/report.pdf \\
  --expires-in 3600 \\
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Use Case:</strong> Share private bucket assets with third-party clients without granting IAM bucket permissions.
                    </div>
                  </div>
                </div>
              )}

              {/* COMMAND SUITE 5: RCLONE SYNC & MOUNT */}
              {terminalTab === 'rclone' && (
                <div className="space-y-4">
                  {/* Hero Description */}
                  <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <RefreshCw className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[var(--app-text)]">
                          Rclone Mount & Bi-Directional Cloud Sync
                        </h3>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Mount Better Drive as a native local drive letter (Z:) in Windows Explorer or directory in Linux/macOS via SFTP (port 2222).
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[11px] border border-purple-500/20">
                      Native Virtual Drive
                    </span>
                  </div>

                  {/* Step 1: Config */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">1</span>
                        Configure Better Drive SFTP Remote (~/.config/rclone/rclone.conf)
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`[betterdrive]
type = sftp
host = 127.0.0.1
port = 2222
user = admin
key_file = ~/.ssh/id_ed25519
shell_type = unix`, 'rclone-conf')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'rclone-conf' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'rclone-conf' ? 'Copied Config!' : 'Copy Config'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-purple-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Add this block to your rclone.conf (or run 'rclone config' and choose SFTP)
[betterdrive]
type = sftp
host = 127.0.0.1
port = 2222
user = admin
key_file = ~/.ssh/id_ed25519
shell_type = unix`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Auth:</strong> Better Drive authenticates exclusively via SSH public keys. Enroll your public key in <strong>Termius / SFTP</strong> in the sidebar before connecting.
                    </div>
                  </div>

                  {/* Step 2: Native Drive Mount */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
                        Mount as Native Hard Drive (Windows Z: or Linux /mnt)
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`# Windows: Mount as Drive Z:
rclone mount betterdrive: Z: --vfs-cache-mode writes --dir-cache-time 1m

# Linux / macOS: Mount to local filesystem
rclone mount betterdrive: /mnt/betterdrive --vfs-cache-mode full --daemon`, 'rclone-mount')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'rclone-mount' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'rclone-mount' ? 'Copied!' : 'Copy Mount'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-purple-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Windows Explorer Mount (Creates virtual drive Z:)
rclone mount betterdrive: Z: --vfs-cache-mode writes --dir-cache-time 1m

# Linux / macOS Mount (Requires FUSE / macFUSE)
rclone mount betterdrive: /mnt/betterdrive --vfs-cache-mode full --daemon`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>VFS Cache Mode:</strong> <code className="text-white font-mono">--vfs-cache-mode writes</code> caches file modifications locally before streaming to the cloud, ensuring smooth compatibility with Word, Excel, and Photoshop.
                    </div>
                  </div>

                  {/* Step 3: Fast Parallel Sync */}
                  <div className="rounded-2xl border border-slate-800 bg-[#090d16] text-slate-100 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
                      <span className="text-[11.5px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">3</span>
                        High-Speed Parallel Sync with Bandwidth Throttling
                      </span>
                      <button
                        type="button"
                        onClick={() => copySnippet(`rclone sync /local/nas/storage betterdrive:nas_backup \\
  --transfers 8 \\
  --bwlimit 20M \\
  --fast-list \\
  --progress`, 'rclone-sync')}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                      >
                        {copiedSnippetKey === 'rclone-sync' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedSnippetKey === 'rclone-sync' ? 'Copied!' : 'Copy Sync Command'}</span>
                      </button>
                    </div>

                    <pre className="p-4 font-mono text-[11px] text-purple-300 overflow-x-auto select-all leading-relaxed whitespace-pre bg-[#090d16]">
{`# Sync local NAS directory to Better Drive cloud pool with 8 threads
rclone sync /local/nas/storage betterdrive:nas_backup \\
  --transfers 8 \\
  --bwlimit 20M \\
  --fast-list \\
  --progress`}
                    </pre>

                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-[11px] text-slate-400">
                      💡 <strong>Bandwidth Limit:</strong> <code className="text-white font-mono">--bwlimit 20M</code> caps transfer speed at 20 Megabytes/sec to prevent saturating home or office internet connections.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARCHITECTURE & MAP */}
          {hubTab === 'map' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-3">
                <span className="font-black text-sm text-[var(--app-text)] flex items-center gap-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  Unified Multi-Cloud Pooling Architecture
                </span>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Better Drive combines distributed storage accounts into a zero-knowledge, encrypted single filesystem:
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                    <strong className="text-[var(--app-text)] block">Client Layer</strong>
                    <span className="text-[11px] text-[var(--app-text-muted)]">Web Browser, Termius SFTP (2222), API CLI</span>
                  </div>
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                    <strong className="text-blue-600 dark:text-blue-400 block">Gateway & Streamer</strong>
                    <span className="text-[11px] text-[var(--app-text-muted)]">Zero-copy streaming, AES-256-GCM chunking</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <strong className="text-emerald-600 dark:text-emerald-400 block">Storage Pool</strong>
                    <span className="text-[11px] text-[var(--app-text-muted)]">Google Drive (15GB free/acc) + S3 + MinIO</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3. Connected Accounts Active Grid */}
      <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-[16px] font-black text-[var(--app-text)]">Active Cloud Storage Accounts</h2>
              <p className="text-xs text-[var(--app-text-muted)]">
                Accounts actively pooled into your virtual filesystem quota.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={connectGoogleDrive} disabled={connecting} className="gap-1.5 text-xs font-bold">
              <Plus className="h-3.5 w-3.5" />
              <span>Connect Drive</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setS3TestResult(null); setS3Open(true) }} className="gap-1.5 text-xs font-bold">
              <Database className="h-3.5 w-3.5 text-blue-500" />
              <span>Connect S3</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-10 text-center space-y-3">
            <Cloud className="w-10 h-10 mx-auto text-[var(--app-text-muted)]" />
            <h3 className="text-sm font-black text-[var(--app-text)]">No Storage Accounts Connected</h3>
            <p className="text-xs text-[var(--app-text-muted)] max-w-sm mx-auto">
              Link your Google Drive or S3-compatible bucket to start storing and pooling files.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" onClick={connectGoogleDrive} disabled={connecting} className="gap-1.5 text-xs font-bold">
                <Link2 className="h-3.5 w-3.5" />
                <span>Connect Google Drive</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setS3TestResult(null); setS3Open(true) }} className="gap-1.5 text-xs font-bold">
                <Database className="h-3.5 w-3.5" />
                <span>Connect S3 Storage</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onRename={handleRename}
                onToggleEnabled={handleToggleEnabled}
                onReauth={handleReauth}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </Card>

      {/* 4. Google OAuth Configuration Card */}
      <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-[16px] font-black text-[var(--app-text)]">Google OAuth Credentials</h2>
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">
                Provide your custom Client ID and Client Secret for Google Drive storage and 1-click Sign-In.
              </p>
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
              hasSecret || googleClientId
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            )}
          >
            {hasSecret || googleClientId ? 'Configured & Active' : 'Setup Required'}
          </span>
        </div>

        <form onSubmit={saveGoogleConfig} className="space-y-4 max-w-2xl text-xs">
          <div>
            <label className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
              Google Client ID
            </label>
            <input
              type="text"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              className="w-full h-10 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--app-text-muted)] mb-1">
              Google Client Secret {hasSecret && <span className="text-emerald-600 font-bold">(Saved on Server)</span>}
            </label>
            <input
              type="password"
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              placeholder={hasSecret ? '•••••••••••••••• (Leave blank to keep current)' : 'Enter Client Secret'}
              className="w-full h-10 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] focus:border-blue-500 outline-none"
            />
          </div>

          <div className="pt-1">
            <Button type="submit" size="sm" disabled={savingGoogleConfig || !googleClientId}>
              {savingGoogleConfig ? 'Saving...' : 'Save Google OAuth Config'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Connect S3 Storage Modal */}
      <DummyModal
        open={s3Open}
        title="Connect S3-Compatible Storage"
        description="Add AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, or any custom S3 endpoint."
        onClose={() => setS3Open(false)}
      >
        <form onSubmit={connectS3} className="grid gap-3 text-xs">
          <div>
            <p className="text-xs font-bold text-[var(--app-text-muted)] mb-1.5">Quick Provider Presets:</p>
            <div className="flex flex-wrap gap-1.5">
              {S3_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setS3TestResult(null)
                    setS3Form((prev) => ({
                      ...prev,
                      name: p.label,
                      region: p.defaultRegion,
                      endpoint: p.defaultEndpoint,
                      forcePathStyle: Boolean(p.forcePathStyle),
                    }))
                  }}
                  className="rounded-lg border border-[var(--card-border)] bg-black/5 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)] hover:bg-blue-500/10 hover:text-blue-600 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Account Display Name (e.g. My R2 Bucket)"
            value={s3Form.name}
            onChange={(e) => setS3Form({ ...s3Form, name: e.target.value })}
            required
          />
          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Bucket Name"
            value={s3Form.bucket}
            onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
            required
          />
          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Region (e.g. us-east-1, auto)"
            value={s3Form.region}
            onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
            required
          />
          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Endpoint URL (optional for AWS S3)"
            value={s3Form.endpoint}
            onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
          />
          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Access Key ID"
            value={s3Form.accessKeyId}
            onChange={(e) => setS3Form({ ...s3Form, accessKeyId: e.target.value })}
            required
          />
          <input
            className="h-10 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs text-[var(--app-text)]"
            placeholder="Secret Access Key"
            type="password"
            value={s3Form.secretAccessKey}
            onChange={(e) => setS3Form({ ...s3Form, secretAccessKey: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={s3Form.forcePathStyle}
              onChange={(e) => setS3Form({ ...s3Form, forcePathStyle: e.target.checked })}
              className="rounded"
            />
            <span>Force path style (required for local MinIO / NAS)</span>
          </label>

          {s3TestResult && (
            <div
              className={cn(
                'rounded-xl p-3 text-xs font-bold flex items-center gap-2',
                s3TestResult.success
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300'
              )}
            >
              {s3TestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
              <span>{s3TestResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={testS3}
              disabled={testingS3 || !s3Form.bucket || !s3Form.accessKeyId || !s3Form.secretAccessKey}
            >
              {testingS3 ? 'Testing Connection...' : 'Test Connection'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setS3Open(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={connectingS3}>
              {connectingS3 ? 'Connecting...' : 'Connect Storage'}
            </Button>
          </div>
        </form>
      </DummyModal>

      {/* Disconnect Account Confirmation Modal */}
      <DummyModal
        open={Boolean(accountToDisconnect)}
        title="Disconnect Storage Account?"
        description="This will detach the account from Better Drive. Files physically remain on your provider, but will no longer be visible or editable inside Better Drive."
        onClose={() => setAccountToDisconnect(null)}
      >
        <div className="grid gap-4 text-xs">
          <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3.5">
            <p className="font-black text-sm text-[var(--app-text)]">{accountToDisconnect?.email}</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-1">
              Provider: {accountToDisconnect?.provider} · Used: {formatBytes(accountToDisconnect?.storageAccount?.usedBytes)}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccountToDisconnect(null)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDisconnect}
              disabled={disconnecting}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
            </Button>
          </div>
        </div>
      </DummyModal>
    </div>
  )
}
