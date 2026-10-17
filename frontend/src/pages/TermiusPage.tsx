import { useEffect, useState, type FormEvent } from 'react'
import {
  Terminal,
  ShieldCheck,
  KeyRound,
  CheckCircle,
  Copy,
  Trash2,
  Plus,
  ExternalLink,
  Laptop,
  Smartphone,
  HardDrive,
  FolderTree,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DummyModal } from '@/components/drive/DummyModal'
import { PageHeader } from '@/components/drive/PageHeader'
import { apiFetch, formatDate } from '@/lib/api'
import { useNotifications } from '@/context/NotificationContext'

type SftpKey = {
  id: string
  label: string
  fingerprint: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

type SftpProfile = {
  id: string
  label: string
  allowRead: boolean
  allowWrite: boolean
  allowDelete: boolean
  allowedRoots: string[]
  maxUploadBytes: string | null
  keys: SftpKey[]
}

type SftpStatusReport = {
  enabled: boolean
  running: boolean
  host: string
  port: number
  hostKeyFingerprint: string
  activeConnections: number
}

type SftpMeResponse = {
  status: SftpStatusReport
  profile: SftpProfile
}

export function TermiusPage() {
  const { notify } = useNotifications()
  const [data, setData] = useState<SftpMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Add Key Modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [keyLabel, setKeyLabel] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [addingKey, setAddingKey] = useState(false)
  const [addError, setAddError] = useState('')

  // Active guide tab
  const [guideTab, setGuideTab] = useState<'desktop' | 'mobile'>('desktop')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch<SftpMeResponse>('/me/sftp')
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SFTP configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function copyText(text: string, fieldId: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    notify.success('Copied', 'Connection parameter copied to clipboard.', { category: 'system' })
    setTimeout(() => {
      setCopiedField((curr) => (curr === fieldId ? null : curr))
    }, 2000)
  }

  async function handleAddKey(e: FormEvent) {
    e.preventDefault()
    setAddError('')
    if (!publicKey.trim()) {
      setAddError('Please enter a public key')
      return
    }

    setAddingKey(true)
    try {
      const resolvedLabel = keyLabel.trim() || 'Termius Key'
      await apiFetch('/me/sftp/keys', {
        method: 'POST',
        body: JSON.stringify({
          label: resolvedLabel,
          publicKey: publicKey.trim(),
        }),
      })
      setKeyLabel('')
      setPublicKey('')
      setAddModalOpen(false)
      notify.success('SSH Key Enrolled', `Key "${resolvedLabel}" enrolled for SFTP access.`, { category: 'sftp' })
      await loadData()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to register key'
      setAddError(errMsg)
      notify.error('Key Enrollment Failed', errMsg, { category: 'sftp' })
    } finally {
      setAddingKey(false)
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!window.confirm('Are you sure you want to revoke this SSH key? Termius sessions using this key will immediately be denied.')) {
      return
    }
    try {
      await apiFetch(`/me/sftp/keys/${keyId}`, { method: 'DELETE' })
      notify.info('SSH Key Revoked', 'Authorized key revoked. Active sessions invalidated.', { category: 'sftp' })
      await loadData()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to revoke key'
      alert(errMsg)
      notify.error('Revocation Failed', errMsg, { category: 'sftp' })
    }
  }

  const sftpHost = window.location.hostname || 'localhost'
  const sftpPort = data?.status.port ?? 2222
  const sshSnippet = `sftp -P ${sftpPort} betterdrive@${sftpHost}`
  const termiusScheme = `termius://ssh/betterdrive@${sftpHost}:${sftpPort}`

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Termius & SFTP Gateway"
        description="Connect Termius on iOS, Android, macOS, or Windows directly to BetterDrive via high-speed zero-trust SFTP."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>Add SSH Key</span>
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Gateway Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gateway Status</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              data?.status.running
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${data?.status.running ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {data?.status.running ? 'Active & Listening' : 'Offline / Standby'}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span>Port {sftpPort}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Host: <code className="font-mono text-slate-700 dark:text-slate-300">{data?.status.host ?? '0.0.0.0'}</code>
            </p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Authentication</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Strict Zero-Password
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span>{data?.profile.keys.filter((k) => !k.revokedAt).length ?? 0} Active Keys</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ed25519 & RSA 4096 public keys only
            </p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Virtual Mounts</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              <FolderTree className="h-3.5 w-3.5" />
              VFS Router
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HardDrive className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <span>/pool, /drive, /s3</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Read: {data?.profile.allowRead ? '✓' : '✗'} | Write: {data?.profile.allowWrite ? '✓' : '✗'}
            </p>
          </div>
        </Card>
      </div>

      {/* Quick Connect & One-Click Termius Snippets */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-600" />
              Termius Quick Setup
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add BetterDrive as an SFTP host in Termius with zero password prompt.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={termiusScheme}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Termius
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Terminal SFTP Connection</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => copyText(sshSnippet, 'cmd')}
              >
                {copiedField === 'cmd' ? <CheckCircle className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'cmd' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <code className="block p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
              {sshSnippet}
            </code>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Host SHA-256 Fingerprint</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => copyText(data?.status.hostKeyFingerprint ?? '', 'fp')}
                disabled={!data?.status.hostKeyFingerprint}
              >
                {copiedField === 'fp' ? <CheckCircle className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'fp' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <code className="block p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto select-all">
              {data?.status.hostKeyFingerprint || 'Generating...'}
            </code>
          </div>
        </div>
      </Card>

      {/* Authorized SSH Keys */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              Authorized SSH Public Keys
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Only keys listed here can authenticate to the SFTP server. Private keys are never accepted or transmitted.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Add Key</span>
          </Button>
        </div>

        {data?.profile.keys.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <KeyRound className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No SSH keys registered yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Add your Termius public key to mount BetterDrive as an SFTP storage target.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>Add Your First Key</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-medium">
                <tr>
                  <th className="pb-3">Label</th>
                  <th className="pb-3">Fingerprint</th>
                  <th className="pb-3">Last Used</th>
                  <th className="pb-3">Added</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data?.profile.keys.map((key) => {
                  const isRevoked = Boolean(key.revokedAt)
                  return (
                    <tr key={key.id} className={isRevoked ? 'opacity-50' : ''}>
                      <td className="py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{key.label}</span>
                        {isRevoked && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-semibold">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                          {key.fingerprint}
                        </code>
                      </td>
                      <td className="py-3 text-xs text-slate-500">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                      </td>
                      <td className="py-3 text-xs text-slate-500">{formatDate(key.createdAt)}</td>
                      <td className="py-3 text-right">
                        {!isRevoked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={() => handleRevokeKey(key.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Step-by-Step Setup Guide */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Termius Connection Walkthrough</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Step-by-step instructions for Termius app clients.</p>
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setGuideTab('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                guideTab === 'desktop'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              Desktop (macOS / Windows)
            </button>
            <button
              onClick={() => setGuideTab('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                guideTab === 'mobile'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile (iOS / Android)
            </button>
          </div>
        </div>

        {guideTab === 'desktop' ? (
          <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <li>
              Open <b>Termius</b> and navigate to <b>Keychain &rarr; Keys &rarr; + New Key</b>.
            </li>
            <li>Select <b>Ed25519</b> (recommended) or <b>RSA 4096</b>, generate the keypair, and tap <b>Copy Public Key</b>.</li>
            <li>In BetterDrive, click <b>Add SSH Key</b> above and paste your public key.</li>
            <li>
              In Termius, go to <b>Hosts &rarr; + New Host</b>:
              <ul className="list-disc list-inside ml-6 mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li><b>Label:</b> BetterDrive SFTP</li>
                <li><b>Address:</b> <code>{sftpHost}</code></li>
                <li><b>Port:</b> <code>{sftpPort}</code></li>
                <li><b>Username:</b> <code>betterdrive</code> (or your email)</li>
                <li><b>Key:</b> Select the Ed25519 key generated in step 1</li>
              </ul>
            </li>
            <li>Click <b>SFTP</b> tab in Termius to browse and transfer files via <code className="text-blue-600">/pool</code>!</li>
          </ol>
        ) : (
          <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <li>Open the <b>Termius Mobile App</b> (iOS / iPadOS / Android).</li>
            <li>Go to <b>Keychain &rarr; Keys &rarr; Generate Key</b> and choose <b>Ed25519</b>.</li>
            <li>Tap <b>Share / Copy Public Key</b> and paste it into the <b>Add SSH Key</b> dialog above.</li>
            <li>Tap <b>Hosts &rarr; + Host</b> and enter Address: <code>{sftpHost}</code>, Port: <code>{sftpPort}</code>, User: <code>betterdrive</code>.</li>
            <li>Assign the key from Keychain. Open the host in SFTP mode to edit, preview, and download your cloud files!</li>
          </ol>
        )}
      </Card>

      {/* Add SSH Key Modal */}
      <DummyModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Termius SSH Public Key"
        description="Register an OpenSSH public key for passwordless SFTP access"
      >
        <form onSubmit={handleAddKey} className="space-y-4">
          {addError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 dark:text-red-400">
              {addError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Key Label</label>
            <Input
              placeholder="e.g. Termius iPhone 15 Pro, MacBook Terminal"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              OpenSSH Public Key (ssh-ed25519 or ssh-rsa)
            </label>
            <textarea
              className="w-full h-32 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... termius-key"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              required
            />
            <p className="text-[11px] text-slate-500">
              Only public keys are stored. Private keys are never accepted.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={addingKey}>
              {addingKey ? 'Registering...' : 'Register Key'}
            </Button>
          </div>
        </form>
      </DummyModal>
    </div>
  )
}
