import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Cloud, Database, FileArchive, FileCode, FileText, Filter, Gauge, Image, Link2, Music, RefreshCw, Sparkles, Trash2, Video, Zap, BookOpen, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/select'
import { DummyModal } from '@/components/drive/DummyModal'
import { PageHeader } from '@/components/drive/PageHeader'
import { apiFetch, formatBytes } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/context/NotificationContext'
import { GoogleSetupModal } from '@/components/auth/GoogleSetupModal'

type StorageSummary = { totalBytes: string; usedBytes: string; availableBytes: string }
type ConnectedAccount = { id: string; email: string; displayName?: string | null; provider: string; status: string; storageAccount?: { totalBytes: string | null; usedBytes: string; availableBytes: string | null; lastSyncedAt: string | null } | null }
type RoutingMode = 'most_available' | 'round_robin' | 'priority'
type RoutingPolicy = { mode: RoutingMode; priorityAccountIds: string[]; roundRobinCursor: number }
type StorageBreakdown = { photo: string; video: string; audio: string; document: string; archive: string; code: string; deduplicatedSavings?: string }
type DuplicateGroup = { checksum: string; count: number; totalBytes: string; reclaimableBytes: string }

function providerLabel(provider: string) {
  if (provider === 's3') return 'S3 Storage'
  return 'Google Drive'
}

function ProviderIcon({ provider }: { provider: string }) {
  const Icon = provider === 's3' ? Database : Cloud
  return <Icon className="h-6 w-6" />
}

function storageLimitLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.totalBytes === null) return 'Unlimited'
  return formatBytes(account.storageAccount?.totalBytes)
}

function availableLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.availableBytes === null) return 'Unlimited'
  return formatBytes(account.storageAccount?.availableBytes)
}

function pct(account: ConnectedAccount) {
  const total = Number(account.storageAccount?.totalBytes ?? 0)
  const used = Number(account.storageAccount?.usedBytes ?? 0)
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
}

function statusColor(percent: number) {
  if (percent >= 80) return 'bg-red-500 text-red-600'
  if (percent >= 50) return 'bg-yellow-400 text-yellow-600'
  return 'bg-emerald-500 text-emerald-600'
}

export function QuotaTrackerPage() {
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [summary, setSummary] = useState<StorageSummary | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>({ mode: 'most_available', priorityAccountIds: [], roundRobinCursor: 0 })
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false)
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)
  const [cleanupPreview, setCleanupPreview] = useState<{
    files: Array<{ id: string; name: string; path: string; size: string; checksum: string; dedupedAgainstFileId: string }>
    freedBytes: string
    deleted: number
  } | null>(null)
  const [cleanupCompleted, setCleanupCompleted] = useState<{ count: number; freedBytes: string } | null>(null)
  const [message, setMessage] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [googleSetupOpen, setGoogleSetupOpen] = useState(false)

  async function load() {
    const [summaryData, accountData, policyData, breakdownData, duplicateData] = await Promise.all([
      apiFetch<StorageSummary>('/storage/summary'),
      apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts'),
      apiFetch<{ policy: RoutingPolicy }>('/storage/routing-policy'),
      apiFetch<StorageBreakdown>('/storage/breakdown').catch(() => null),
      apiFetch<{ groups: DuplicateGroup[] }>('/files/duplicates').catch(() => ({ groups: [] })),
    ])
    setSummary(summaryData)
    setAccounts(accountData.accounts)
    setRoutingPolicy(policyData.policy)
    if (breakdownData) setBreakdown(breakdownData)
    if (duplicateData?.groups) setDuplicateGroups(duplicateData.groups)
  }

  async function openCleanupModal() {
    setCleaningDuplicates(true)
    setMessage('')
    try {
      const res = await apiFetch<{ deleted: number; freedBytes: string; files: any[] }>('/files/duplicates/cleanup', {
        method: 'POST',
        body: JSON.stringify({ keep: 'oldest', dryRun: true }),
      })
      setCleanupPreview(res)
      setCleanupCompleted(null)
      setCleanupModalOpen(true)
    } catch (err: any) {
      const errMsg = err.message || 'Failed to inspect duplicates'
      setMessage(errMsg)
      notify.error('Inspection Failed', errMsg, { category: 'storage' })
    } finally {
      setCleaningDuplicates(false)
    }
  }

  async function executeCleanup() {
    setCleaningDuplicates(true)
    setMessage('')
    try {
      const res = await apiFetch<{ deleted: number; freedBytes: string; files: any[] }>('/files/duplicates/cleanup', {
        method: 'POST',
        body: JSON.stringify({ keep: 'oldest', dryRun: false }),
      })
      setCleanupCompleted({ count: res.deleted, freedBytes: res.freedBytes })
      const successMsg = `Successfully moved ${res.deleted} duplicate file(s) to trash and freed ${formatBytes(res.freedBytes)}!`
      setMessage(successMsg)
      notify.success('Duplicates Moved to Trash', successMsg, { category: 'storage' })
      await load()
    } catch (err: any) {
      const errMsg = err.message || 'Failed to clean duplicates'
      setMessage(errMsg)
      notify.error('Cleanup Failed', errMsg, { category: 'storage' })
    } finally {
      setCleaningDuplicates(false)
    }
  }

  async function refresh() {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load quota tracker'))
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => load().catch(() => undefined), 35_000)
    return () => window.clearInterval(timer)
  }, [autoRefresh])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'GOOGLE_CONNECTED') return
      const isSuccess = event.data.status === 'success'
      const msg = isSuccess ? 'Google Drive connected.' : 'Google Drive connection failed.'
      setMessage(msg)
      if (isSuccess) {
        notify.success('Google Drive Connected', 'Account linked successfully to storage pool.', { category: 'storage' })
      } else {
        notify.error('Connection Failed', 'Could not link Google Drive account.', { category: 'storage' })
      }
      load().catch(() => undefined)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [notify])

  async function connectDrive() {
    const popup = window.open('', 'google-drive-connect', 'width=540,height=720')
    if (popup) {
      popup.document.write('<html><head><title>Connecting...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#64748b;}</style></head><body><div style="text-align:center;"><h2>Connecting to Google...</h2><p>Please wait while we redirect you.</p></div></body></html>')
    }
    try {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url')
      if (popup) {
        popup.location.href = data.url
      } else {
        window.location.href = data.url
      }
    } catch (e: any) {
      if (popup) popup.close()
      const msg = e?.message || ''
      if (msg.includes('not configured') || msg.includes('GOOGLE_CONFIG_MISSING')) {
        setGoogleSetupOpen(true)
      } else {
        notify.error('Connection Failed', msg || 'Failed to start Google Drive connection.', { category: 'storage' })
      }
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId)
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, { method: 'POST' })
      await load()
      notify.success('Quota Synced', 'Storage account refreshed.', { category: 'storage' })
    } catch (err: any) {
      notify.error('Sync Failed', err.message || 'Could not sync quota.', { category: 'storage' })
    } finally {
      setSyncingAccountId(null)
    }
  }

  async function saveRoutingPolicy(nextPolicy: RoutingPolicy) {
    setRoutingPolicy(nextPolicy)
    const data = await apiFetch<{ policy: RoutingPolicy }>('/storage/routing-policy', { method: 'PATCH', body: JSON.stringify({ mode: nextPolicy.mode, priorityAccountIds: nextPolicy.priorityAccountIds }) })
    setRoutingPolicy(data.policy)
    setMessage('Upload routing policy updated.')
    notify.success('Routing Policy Updated', `Mode set to ${nextPolicy.mode.replace('_', ' ')}.`, { category: 'system' })
  }

  function orderedAccounts() {
    const byId = new Map(accounts.map((account) => [account.id, account]))
    const ordered = routingPolicy.priorityAccountIds.map((id) => byId.get(id)).filter((account): account is ConnectedAccount => Boolean(account))
    const orderedIds = new Set(ordered.map((account) => account.id))
    return [...ordered, ...accounts.filter((account) => !orderedIds.has(account.id))]
  }

  function moveAccount(accountId: string, direction: -1 | 1) {
    const ids = orderedAccounts().map((account) => account.id)
    const index = ids.indexOf(accountId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) return
    const nextIds = [...ids]
    const [item] = nextIds.splice(index, 1)
    nextIds.splice(target, 0, item)
    saveRoutingPolicy({ ...routingPolicy, priorityAccountIds: nextIds }).catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to update routing policy'))
  }

  return (
    <>
      <PageHeader title="Quota Tracker" description="Track and manage connected provider storage limits." actions={<><Button variant="outline" onClick={() => setAutoRefresh(!autoRefresh)}><CheckCircle className="h-4 w-4" />Auto-refresh {autoRefresh ? 'On' : 'Off'}</Button><Button variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />{refreshing ? 'Refreshing...' : 'Refresh'}</Button><Button onClick={connectDrive}><Link2 className="h-4 w-4" />Connect Drive</Button></>} />
      {message ? <p className="mt-5 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 text-sm font-semibold text-blue-700 dark:text-blue-300 shadow-xs">{message}</p> : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <p className="text-sm font-bold text-[var(--app-text-muted)]">Total Storage</p>
          <p className="mt-2 text-2xl font-black text-[var(--app-text)]">{formatBytes(summary?.totalBytes)}</p>
        </Card>
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <p className="text-sm font-bold text-[var(--app-text-muted)]">Used Storage</p>
          <p className="mt-2 text-2xl font-black text-[var(--app-text)]">{formatBytes(summary?.usedBytes)}</p>
        </Card>
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <p className="text-sm font-bold text-[var(--app-text-muted)]">Available</p>
          <p className="mt-2 text-2xl font-black text-[var(--app-text)]">{formatBytes(summary?.availableBytes)}</p>
        </Card>
        <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <p className="text-sm font-bold text-[var(--app-text-muted)]">Accounts</p>
          <p className="mt-2 text-2xl font-black text-[var(--app-text)]">{accounts.length}</p>
        </Card>
      </div>

      {/* Better Drive Storage Optimizer & Deduplication Engine */}
      <Card className="mt-8 overflow-hidden border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="border-b border-[var(--card-border)] bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-[var(--app-text)]">Storage Optimizer & Deduplication</h2>
                  <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-black text-blue-600 dark:text-blue-400">Better Drive Engine</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-[var(--app-text-muted)]">
                  Instant SHA-256 zero-copy deduplication saves cloud quota and network bandwidth.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3.5 py-2 border border-blue-500/20">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                  {formatBytes(breakdown?.deduplicatedSavings || '0')} Saved via Dedup
                </span>
              </div>

              {duplicateGroups.length > 0 ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={openCleanupModal}
                  disabled={cleaningDuplicates}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {cleaningDuplicates ? 'Inspecting...' : `Clean Duplicates (${formatBytes(duplicateGroups.reduce((acc, g) => {
                    try { return acc + BigInt(g.reclaimableBytes || '0') } catch { return acc }
                  }, 0n).toString())})`}
                </Button>
              ) : (
                <span className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> No Redundant Duplicates
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Granular Storage Categories */}
        <div className="p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-muted)] mb-4">Storage Breakdown by Type</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Photos', icon: Image, bytes: breakdown?.photo || '0', color: 'bg-emerald-500', barBg: 'bg-emerald-500/20' },
              { label: 'Videos', icon: Video, bytes: breakdown?.video || '0', color: 'bg-purple-500', barBg: 'bg-purple-500/20' },
              { label: 'Audio', icon: Music, bytes: breakdown?.audio || '0', color: 'bg-amber-500', barBg: 'bg-amber-500/20' },
              { label: 'Documents', icon: FileText, bytes: breakdown?.document || '0', color: 'bg-blue-500', barBg: 'bg-blue-500/20' },
              { label: 'Archives', icon: FileArchive, bytes: breakdown?.archive || '0', color: 'bg-rose-500', barBg: 'bg-rose-500/20' },
              { label: 'Code & Text', icon: FileCode, bytes: breakdown?.code || '0', color: 'bg-cyan-500', barBg: 'bg-cyan-500/20' },
            ].map((cat) => {
              const used = Number(summary?.usedBytes || 0)
              const catBytes = Number(cat.bytes)
              const percent = used > 0 && catBytes > 0 ? Math.min(100, Math.round((catBytes / used) * 100)) : 0
              const Icon = cat.icon
              return (
                <div key={cat.label} className="rounded-xl border border-[var(--card-border)] bg-slate-500/5 p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--app-text-muted)]">{cat.label}</span>
                    <Icon className="h-4 w-4 text-[var(--app-text-muted)]" />
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-black text-[var(--app-text)]">{formatBytes(cat.bytes)}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-300', cat.color)} style={{ width: `${percent}%` }} />
                    </div>
                    <span className="mt-1 block text-[10px] font-semibold text-[var(--app-text-muted)]">{percent}% of used</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="outline"><Filter className="h-4 w-4" />All Providers</Button>
        <Button variant="outline">All Accounts</Button>
        <Button variant="soft"><Gauge className="h-4 w-4" />Most available</Button>
      </div>

      <Card className="mt-6 p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-[var(--app-text)]">Upload Routing</h2>
            <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)]">Choose how new uploads pick connected storage accounts.</p>
          </div>
          <div className="grid gap-2 text-sm font-bold text-[var(--app-text)] lg:w-64">
            <span>Routing mode</span>
            <CustomSelect
              value={routingPolicy.mode}
              onChange={(val) => saveRoutingPolicy({ ...routingPolicy, mode: val as RoutingMode }).catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to update routing policy'))}
              options={[
                { value: 'most_available', label: 'Most available' },
                { value: 'round_robin', label: 'Round robin' },
                { value: 'priority', label: 'Priority order' },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {orderedAccounts().map((account, index) => (
            <div key={account.id} className="flex flex-col gap-3 rounded-xl bg-slate-500/5 p-3.5 border border-[var(--card-border)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <ProviderIcon provider={account.provider} />
                </div>
                <div>
                  <p className="font-bold text-[var(--app-text)]">{account.displayName || account.email}</p>
                  <p className="text-sm font-semibold text-[var(--app-text-muted)]">
                    {providerLabel(account.provider)} · {formatBytes(account.storageAccount?.usedBytes)} used · {availableLabel(account)} free
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => moveAccount(account.id, -1)} disabled={index === 0}>Up</Button>
                <Button variant="outline" size="sm" onClick={() => moveAccount(account.id, 1)} disabled={index === accounts.length - 1}>Down</Button>
              </div>
            </div>
          ))}
          {accounts.length === 0 ? <p className="text-sm font-semibold text-[var(--app-text-muted)]">Connect storage accounts to configure routing.</p> : null}
        </div>
      </Card>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {accounts.length === 0 ? (
          <Card className="col-span-full p-8 text-center border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
            <Cloud className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-4 text-xl font-black text-[var(--app-text)]">No connected storage accounts</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--app-text-muted)] max-w-lg mx-auto leading-relaxed">
              Connect Google Drive or S3-compatible cloud storage (Cloudflare R2, MinIO, Wasabi, AWS S3) to build your unified high-speed storage pool.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={connectDrive} className="font-bold">
                <Link2 className="h-4 w-4" />
                Connect Google Drive
              </Button>
              <Button variant="outline" onClick={() => navigate('/settings?tab=guide')} className="font-bold">
                <BookOpen className="h-4 w-4" />
                Storage Setup Guides
              </Button>
              <Button variant="outline" onClick={() => navigate('/settings')} className="font-bold">
                Manage in Settings
              </Button>
            </div>
          </Card>
        ) : accounts.map((account) => {
          const percent = pct(account)
          const color = statusColor(percent)
          return (
            <Card key={account.id} className="overflow-hidden p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <ProviderIcon provider={account.provider} />
                  </div>
                  <div>
                    <h2 className="font-black text-[var(--app-text)]">{providerLabel(account.provider)}</h2>
                    <p className="text-sm font-semibold text-[var(--app-text-muted)]">{account.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => sync(account.id)} disabled={syncingAccountId === account.id}>
                    <RefreshCw className={syncingAccountId === account.id ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
                  </Button>
                </div>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-bold text-[var(--app-text)]">
                    <span className={cn('h-3 w-3 rounded-full', color.split(' ')[0])} />Storage Quota
                  </span>
                  <span className="font-black text-[var(--app-text)]">{percent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/15 dark:bg-white/20 border border-black/15 dark:border-white/25 shadow-inner overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-300', color.split(' ')[0])} style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm font-bold text-[var(--app-text-muted)]">
                  <span>{formatBytes(account.storageAccount?.usedBytes)} / {storageLimitLabel(account)}</span>
                  <span>Available {availableLabel(account)}</span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <GoogleSetupModal
        isOpen={googleSetupOpen}
        onClose={() => setGoogleSetupOpen(false)}
      />

      <DummyModal
        open={cleanupModalOpen}
        onClose={() => setCleanupModalOpen(false)}
        title="Duplicate File Cleanup"
        description="Review redundant files before moving them to trash."
        className="sm:max-w-xl"
      >
        {cleanupCompleted ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200">
              <p className="font-bold">Cleanup Complete</p>
              <p className="mt-1 text-sm">
                Moved {cleanupCompleted.count} file(s) to trash and freed {formatBytes(cleanupCompleted.freedBytes)}.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Link
                to="/trash"
                className="text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => setCleanupModalOpen(false)}
              >
                Go to Trash →
              </Link>
              <Button variant="outline" onClick={() => setCleanupModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Safe Trash Policy</p>
                <p className="mt-0.5">
                  Files will be moved to trash and can be restored anytime before retention expiration. No provider files will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-[var(--card-border)] rounded-xl border border-[var(--card-border)] bg-slate-500/5">
              {!cleanupPreview?.files || cleanupPreview.files.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--app-text-muted)]">
                  No redundant files identified for deletion.
                </div>
              ) : (
                cleanupPreview.files.map((file) => (
                  <div key={file.id} className="p-3 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--app-text)] truncate max-w-[280px]" title={file.name}>
                        {file.name}
                      </span>
                      <span className="font-mono text-[var(--app-text-muted)]">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--app-text-muted)]">
                      <span className="truncate max-w-[240px]" title={file.path}>
                        {file.path || '/'}
                      </span>
                      <span className="font-mono" title={`SHA-256: ${file.checksum}`}>
                        hash: {file.checksum ? `${file.checksum.slice(0, 8)}...` : 'n/a'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setCleanupModalOpen(false)}
                disabled={cleaningDuplicates}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={executeCleanup}
                disabled={cleaningDuplicates || !cleanupPreview?.files || cleanupPreview.files.length === 0}
              >
                {cleaningDuplicates ? (
                  'Moving to trash...'
                ) : (
                  `Move ${cleanupPreview?.files?.length || 0} file(s) to trash`
                )}
              </Button>
            </div>
          </div>
        )}
      </DummyModal>
    </>
  )
}
