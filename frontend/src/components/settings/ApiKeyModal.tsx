import { useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateKey: (label: string) => Promise<string> // returns plaintext key
}

export function ApiKeyModal({ isOpen, onClose, onCreateKey }: ApiKeyModalProps) {
  const [label, setLabel] = useState('')
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasCopiedChecked, setHasCopiedChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleResetAndClose = () => {
    setLabel('')
    setPlaintextKey(null)
    setCopied(false)
    setHasCopiedChecked(false)
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const key = await onCreateKey(label.trim())
      setPlaintextKey(key)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create API key.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!plaintextKey) return
    try {
      await navigator.clipboard.writeText(plaintextKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6 overflow-hidden">
        <button
          type="button"
          onClick={handleResetAndClose}
          disabled={Boolean(plaintextKey && !hasCopiedChecked)}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {plaintextKey ? 'API Key Created' : 'Create API Key'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {plaintextKey
                ? 'Store your API key now. It will never be shown again.'
                : 'Programmatic Bearer token for automated uploads and API access.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!plaintextKey ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="api-key-label"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Key Label / Description
              </label>
              <Input
                id="api-key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. GitHub Actions Deploy, Backup Script"
                required
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleResetAndClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !label.trim()}>
                {isSubmitting ? 'Generating...' : 'Create Key'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Please copy your API key now and store it in a secure password manager. For security reasons, BetterDrive only stores a SHA-256 hash and cannot show it to you again.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Your Secret API Key
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={plaintextKey}
                  aria-label="Generated API Key"
                  className="font-mono text-xs select-all bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3"
                  aria-label="Copy key to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="acknowledge-copied"
                  checked={hasCopiedChecked}
                  onChange={(e) => setHasCopiedChecked(e.target.checked)}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                  I have copied and securely saved this API key
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end pt-3">
              <Button
                type="button"
                onClick={handleResetAndClose}
                disabled={!hasCopiedChecked}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
