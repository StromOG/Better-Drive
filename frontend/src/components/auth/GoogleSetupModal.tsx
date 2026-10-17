import { useState } from 'react'
import { Check, Copy, ExternalLink, KeyRound, ShieldCheck, HelpCircle, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleLogo } from './GoogleLogo'

interface GoogleSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function GoogleSetupModal({ isOpen, onClose }: GoogleSetupModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'steps' | 'scopes'>('steps')

  const backendPort = '4000'
  const host = window.location.hostname || 'localhost'
  const protocol = window.location.protocol || 'http:'
  const apiBase = `${protocol}//${host}:${backendPort}`

  const storageRedirectUri = `${apiBase}/connected-accounts/google/callback`
  const authRedirectUri = `${apiBase}/auth/google/callback`

  if (!isOpen) return null

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative overflow-hidden w-full max-w-xl rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-text)] shadow-2xl shadow-black/40 backdrop-blur-xl flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-setup-title"
      >
        {/* Accent highlight bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-500" />

        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 pb-4 border-b border-[var(--card-border)] bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md border border-slate-200 dark:border-slate-800">
              <GoogleLogo className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="google-setup-title" className="text-lg font-black tracking-tight text-[var(--app-text)]">
                  Google Sign-In & Drive Setup
                </h2>
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                  OAuth 2.0
                </span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-[var(--app-text-muted)]">
                Connect your Google Cloud project to enable 1-click login and cloud drive pooling.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--app-text-muted)] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--app-text)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex px-5 sm:px-6 gap-3 border-b border-[var(--card-border)] bg-black/5 dark:bg-white/5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('steps')}
            className={`pb-3 pt-2.5 px-3 transition-all cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] ${
              activeTab === 'steps'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold'
                : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 text-blue-500" />
            <span>4-Step Quick Setup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scopes')}
            className={`pb-3 pt-2.5 px-3 transition-all cursor-pointer flex items-center gap-1.5 border-b-2 -mb-[1px] ${
              activeTab === 'scopes'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold'
                : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Scopes & Security FAQ</span>
          </button>
        </div>

        {/* Body content */}
        <div className="overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-4 text-xs">
          {activeTab === 'steps' ? (
            <>
              {/* Step 1 */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[var(--app-text)] text-sm flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">1</span>
                    Open Google Cloud Console
                  </span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-xs text-[11px]"
                  >
                    <span>Console Link</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Sign in to your Google Account, select or create a project (e.g. <strong className="text-[var(--app-text)]">BetterDrive Storage</strong>).
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-1.5">
                <span className="font-extrabold text-[var(--app-text)] text-sm flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">2</span>
                  Enable the Google Drive API
                </span>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Go to <strong className="text-[var(--app-text)]">APIs & Services → Library</strong>, search for <strong className="text-[var(--app-text)]">Google Drive API</strong>, and click <strong className="text-[var(--app-text)]">Enable</strong>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[var(--app-text)] text-sm flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">3</span>
                    Authorized Redirect URIs
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(`${storageRedirectUri}\n${authRedirectUri}`, 'both-uris')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'both-uris' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'both-uris' ? 'Copied Both!' : 'Copy Both URIs'}</span>
                  </button>
                </div>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Under <strong className="text-[var(--app-text)]">Credentials → Create Credentials → OAuth client ID</strong>, choose <strong className="text-[var(--app-text)]">Web application</strong>. Paste both URIs under <strong className="text-[var(--app-text)]">Authorized redirect URIs</strong>:
                </p>

                {/* Storage URI Box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                    Storage / Drive Pooling URI:
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 font-mono text-[11px] font-bold text-[var(--app-text)] select-all truncate">
                      {storageRedirectUri}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(storageRedirectUri, 'storage-uri')}
                      className="shrink-0 gap-1 font-bold text-xs"
                    >
                      {copiedKey === 'storage-uri' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'storage-uri' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>

                {/* Login URI Box */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    1-Click Google Sign-In URI:
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 font-mono text-[11px] font-bold text-[var(--app-text)] select-all truncate">
                      {authRedirectUri}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(authRedirectUri, 'auth-uri')}
                      className="shrink-0 gap-1 font-bold text-xs"
                    >
                      {copiedKey === 'auth-uri' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKey === 'auth-uri' ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 flex flex-col gap-1.5">
                <span className="font-extrabold text-[var(--app-text)] text-sm flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">4</span>
                  Save Client ID & Client Secret in Settings
                </span>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Copy the generated <strong className="text-[var(--app-text)]">Client ID</strong> and <strong className="text-[var(--app-text)]">Client Secret</strong>. Paste them in <strong className="text-[var(--app-text)]">Settings → Google OAuth Credentials</strong> or inside your <code className="rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-[var(--app-text)] font-bold">backend/.env</code> file.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-3.5">
              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[var(--app-text)]">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Privacy & Self-Hosted Token Storage</span>
                </div>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  All OAuth refresh tokens and access secrets are stored locally inside your embedded database encrypted with <strong className="text-[var(--app-text)]">AES-256-GCM</strong>. Your tokens never leave your host or ping any third-party telemetry.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-[var(--app-text)]">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span>Required OAuth Scopes</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="rounded-lg bg-black/10 dark:bg-white/10 p-2 text-[var(--app-text)]">
                    https://www.googleapis.com/auth/drive
                  </div>
                  <div className="rounded-lg bg-black/10 dark:bg-white/10 p-2 text-[var(--app-text)]">
                    https://www.googleapis.com/auth/userinfo.email
                  </div>
                  <div className="rounded-lg bg-black/10 dark:bg-white/10 p-2 text-[var(--app-text)]">
                    https://www.googleapis.com/auth/userinfo.profile
                  </div>
                </div>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  These scopes allow Better Drive to read/write storage chunks in your Google Drive and verify your email identity.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-[var(--app-text)]">
                  <HelpCircle className="h-4 w-4 text-amber-500" />
                  <span>OAuth Consent Screen "Unverified App" Warning?</span>
                </div>
                <p className="text-[var(--app-text-muted)] leading-relaxed">
                  Because this is your own private self-hosted project, you do not need Google verification. In the OAuth consent screen, set User Type to <strong className="text-[var(--app-text)]">External</strong> and add your own Google email as a Test User. When connecting, click <em className="text-[var(--app-text)]">"Advanced → Go to Better Drive (unsafe)"</em> once.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 px-5 sm:px-6 border-t border-[var(--card-border)] bg-black/5 dark:bg-white/5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyText(storageRedirectUri, 'footer-copy')}
            className="gap-1.5 text-xs font-bold"
          >
            {copiedKey === 'footer-copy' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedKey === 'footer-copy' ? 'Copied Storage URI!' : 'Copy Drive Storage URI'}</span>
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="px-5 text-xs font-bold"
          >
            Understood
          </Button>
        </div>
      </div>
    </div>
  )
}
