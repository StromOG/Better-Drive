import { useEffect, useState } from 'react'
import { Plus, Trash2, KeyRound, Copy, Check, Terminal, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/drive/PageHeader'
import { ApiKeyModal } from '@/components/settings/ApiKeyModal'
import { ConfirmationDialog } from '@/components/settings/ConfirmationDialog'
import { apiFetch, API_URL } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface ApiKeyRecord {
  id: string
  label: string
  name: string
  keyPrefix: string
  status: 'active' | 'revoked'
  lastUsedAt?: string | null
  revokedAt?: string | null
  createdAt: string
}

const curlExample = `curl -X POST "${API_URL}/api/v1/uploads" \\
  -H "Authorization: Bearer bd_live_xxx" \\
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \\
  -F "file-0=@hello.txt;type=text/plain"`

const jsExample = `const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

await fetch('${API_URL}/api/v1/uploads', {
  method: 'POST',
  headers: { Authorization: 'Bearer bd_live_xxx' },
  body: form,
})`

const pythonExample = `import requests

url = "${API_URL}/api/v1/uploads"
headers = {"Authorization": "Bearer bd_live_xxx"}
files = {"file-0": ("hello.txt", open("hello.txt", "rb"), "text/plain")}
data = {"filesMeta": '[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]'}

response = requests.post(url, headers=headers, data=data, files=files)
print(response.json())`

export function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyRecord | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'js' | 'python'>('curl')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const fetchKeys = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ apiKeys: ApiKeyRecord[] }>('/me/api-keys')
      setApiKeys(data.apiKeys || [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreateKey = async (label: string): Promise<string> => {
    const data = await apiFetch<{ apiKey: ApiKeyRecord; plaintext: string }>('/me/api-keys', {
      method: 'POST',
      body: JSON.stringify({ label }),
    })
    setApiKeys((prev) => [data.apiKey, ...prev])
    return data.plaintext
  }

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return
    setIsRevoking(true)
    try {
      await apiFetch(`/me/api-keys/${keyToRevoke.id}`, {
        method: 'DELETE',
      })
      await fetchKeys()
    } finally {
      setIsRevoking(false)
      setKeyToRevoke(null)
    }
  }

  const activeCount = apiKeys.filter((k) => k.status === 'active' && !k.revokedAt).length

  return (
    <div className="w-full space-y-6">
      {/* Standalone Page Header */}
      <PageHeader
        title="API Keys"
        description="Programmatic access tokens for automated scripts, CLI tools, and background pipelines."
        actions={
          <Button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Create API Key</span>
          </Button>
        }
      />

      {/* Metric Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Active Keys</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">{activeCount} of {apiKeys.length} total</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Authentication</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Bearer Token (SHA-256)</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 p-3.5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <Code2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">API Scope</p>
            <p className="text-sm font-black text-[var(--app-text)] truncate">Full Virtual FS Access</p>
          </div>
        </Card>
      </div>

      {/* API Keys Table Card */}
      <Card className="overflow-hidden border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[var(--app-text)]">Enrolled API Keys</h2>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Secret keys are visible only once upon generation. Keep your tokens stored securely.
            </p>
          </div>
          <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
            {activeCount} Active
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--app-text-muted)] space-y-3">
            <KeyRound className="h-10 w-10 mx-auto text-[var(--app-text-muted)]" />
            <p className="font-bold text-sm text-[var(--app-text)]">No API keys created yet</p>
            <p className="max-w-sm mx-auto">Generate a key to authenticate automated requests and upload pipelines via Bearer authorization.</p>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create First API Key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--card-border)] bg-black/5 dark:bg-white/5 text-[11px] font-bold text-[var(--app-text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4">Label</th>
                  <th className="py-3 px-4">Key Prefix</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Last Used</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {apiKeys.map((key) => {
                  const isRevoked = key.status === 'revoked' || Boolean(key.revokedAt)
                  return (
                    <tr
                      key={key.id}
                      className="hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <td className="py-3 px-4 font-bold text-xs text-[var(--app-text)]">
                        {key.label || key.name}
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-md font-mono text-[var(--app-text)] font-semibold">
                          {key.keyPrefix}...
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize border',
                            isRevoked
                              ? 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          )}
                        >
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--app-text-muted)]">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--app-text-muted)]">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isRevoked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setKeyToRevoke(key)}
                            aria-label={`Revoke API key ${key.label}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-500/10 h-8 px-2.5 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            <span>Revoke</span>
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

      {/* Code Examples Card */}
      <Card className="p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
          <div>
            <h3 className="text-sm font-black text-[var(--app-text)]">API Quickstart & Code Examples</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
              Authenticate requests by including your key in the Authorization header as a Bearer token.
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)] text-xs font-bold">
            {(['curl', 'js', 'python'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveSnippetTab(lang)}
                className={cn(
                  'px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-black transition cursor-pointer',
                  activeSnippetTab === lang
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                )}
              >
                {lang === 'js' ? 'Node.js' : lang}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl border border-slate-800 bg-[#090d16] p-4 text-emerald-400 font-mono text-[11.5px] overflow-x-auto select-all leading-relaxed">
          <div className="absolute top-3 right-3">
            <button
              type="button"
              onClick={() => {
                const code =
                  activeSnippetTab === 'curl'
                    ? curlExample
                    : activeSnippetTab === 'js'
                    ? jsExample
                    : pythonExample
                copyCode(code, activeSnippetTab)
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-slate-800 text-slate-200 hover:text-white transition cursor-pointer"
            >
              {copiedKey === activeSnippetTab ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedKey === activeSnippetTab ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="pr-24">
            {activeSnippetTab === 'curl' && curlExample}
            {activeSnippetTab === 'js' && jsExample}
            {activeSnippetTab === 'python' && pythonExample}
          </pre>
        </div>
      </Card>

      <ApiKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateKey={handleCreateKey}
      />

      <ConfirmationDialog
        isOpen={Boolean(keyToRevoke)}
        title="Revoke API Key"
        description={`Are you sure you want to revoke the key "${keyToRevoke?.label || keyToRevoke?.name}"? Any applications or automated scripts using this key will immediately be blocked with 401 Unauthorized.`}
        confirmLabel="Revoke Key"
        isDestructive={true}
        isLoading={isRevoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setKeyToRevoke(null)}
      />
    </div>
  )
}
