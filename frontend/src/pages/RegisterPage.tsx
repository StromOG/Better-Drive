import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GoogleLogo } from '@/components/auth/GoogleLogo'
import { GoogleSetupModal } from '@/components/auth/GoogleSetupModal'
import { ByteAuthCompanion, isGibberish, type MascotMood } from '@/components/mascot'
import { CandyDecorations } from '@/components/auth/CandyDecorations'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api'
import { BrandLogo } from '@/components/drive/BrandLogo'
import { setAuthSession, type AuthUser } from '@/lib/auth'
import { formatFriendlyAuthError } from '@/lib/errorUtils'

type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser }
type GoogleUrlResponse = { configured?: boolean; url?: string; message?: string }
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim()

declare global {
  interface Window {
    grecaptcha?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }) => number
      reset: (widgetId?: number) => void
    }
  }
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isOwnerSetup, setIsOwnerSetup] = useState(searchParams.get('setup') === 'owner')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [activeField, setActiveField] = useState<'name' | 'email' | 'password' | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [setupModalOpen, setSetupModalOpen] = useState(false)
  const recaptchaRef = useRef<HTMLDivElement | null>(null)
  const recaptchaWidgetId = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    apiFetch<{ needsOwner: boolean }>('/auth/setup-status', { skipAuth: true })
      .then((res) => {
        if (active && res?.needsOwner) {
          setIsOwnerSetup(true)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  // Only check email or name for obvious keyboard mash; passwords must never be flagged as gibberish
  const isInputGibberish =
    activeField === 'email'
      ? isGibberish(email)
      : activeField === 'name'
      ? isGibberish(name)
      : false

  // Compute mascot mood reactively based on user interaction
  let mascotMood: MascotMood = 'idle'
  if (loading) mascotMood = 'submitting'
  else if (error) mascotMood = 'searching'
  else if (isInputGibberish) mascotMood = 'confused'
  else if (activeField === 'password') mascotMood = showPassword ? 'peek' : 'password'
  else if (activeField === 'email' || activeField === 'name') mascotMood = 'email'

  useEffect(() => {
    if (!recaptchaSiteKey) return
    const scriptId = 'google-recaptcha-script'
    const renderCaptcha = () => {
      if (!recaptchaRef.current || !window.grecaptcha || recaptchaWidgetId.current !== null) return
      recaptchaWidgetId.current = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: recaptchaSiteKey,
        callback: setCaptchaToken,
        'expired-callback': () => setCaptchaToken(''),
      })
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = renderCaptcha
      document.body.appendChild(script)
    } else {
      renderCaptcha()
    }
  }, [])

  async function continueWithGoogle() {
    setGoogleLoading(true)
    setError('')
    try {
      const data = await apiFetch<GoogleUrlResponse>('/auth/google/url', { skipAuth: true })
      if (data.configured === false || !data.url) {
        setSetupModalOpen(true)
      } else {
        window.location.href = data.url
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('not configured') || message.includes('GOOGLE_NOT_CONFIGURED')) {
        setSetupModalOpen(true)
      } else {
        setError(formatFriendlyAuthError(err))
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    if (!isOwnerSetup && recaptchaSiteKey && !captchaToken) {
      setError('Please complete the verification captcha.')
      setLoading(false)
      return
    }
    try {
      const data = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ name, email, password, captchaToken: isOwnerSetup ? undefined : captchaToken }),
      })
      setAuthSession(data.accessToken, data.refreshToken, data.user)
      navigate('/all-files')
    } catch (err) {
      setError(formatFriendlyAuthError(err))
      if (recaptchaWidgetId.current !== null) window.grecaptcha?.reset(recaptchaWidgetId.current)
      setCaptchaToken('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:py-12 transition-colors">
      {/* Candy Pastel Gradient Backdrop & Floating Orbs */}
      <CandyDecorations />

      {/* 100% Dead-Centered Layout */}
      <div className="relative z-10 w-full flex items-center justify-center">
        {/* Main Auth Form Column (Dead-Centered on Screen) */}
        <div className="relative w-full max-w-[420px] flex flex-col items-center">
          {/* Brand Header: Profile Rectangle Lockup */}
          <div className="mb-5 sm:mb-7 flex w-full items-center justify-center">
            <div className="flex items-center gap-4 sm:gap-5 max-w-full">
              <BrandLogo className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 drop-shadow-xl transition-transform hover:scale-105 duration-300" />
              <div className="flex flex-col justify-center text-left min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {isOwnerSetup ? 'Initialize Master Owner' : 'Create an Account'}
                </h1>
                <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
                  {isOwnerSetup
                    ? 'Administrator setup for this Better Drive gateway'
                    : 'Get started with your unified cloud storage'}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Companion: Naturally docked with speech bubble at mouth level */}
          <div className="flex lg:hidden w-full mb-5 items-center justify-center">
            <ByteAuthCompanion mood={mascotMood} errorMessage={error} isMobile />
          </div>

          {/* Frosted Candy Card with Crisp Arctic Elevation */}
          <Card className="w-full relative overflow-hidden rounded-3xl border border-sky-200/90 bg-white/95 p-6 shadow-[0_20px_50px_rgba(37,99,235,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-sky-500/30 dark:bg-slate-900/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {/* Top candy gradient highlight bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-rose-400" />

            {isOwnerSetup && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-pink-300/60 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-sky-500/15 p-2.5 text-xs font-bold text-pink-600 dark:text-pink-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>First User Becomes Master Administrator</span>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setActiveField('name')}
                    onBlur={() => setActiveField(null)}
                    className="pl-10 rounded-2xl border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/25 dark:focus:border-sky-400 dark:focus:ring-sky-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setActiveField('email')}
                    onBlur={() => setActiveField(null)}
                    className="pl-10 rounded-2xl border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/25 dark:focus:border-sky-400 dark:focus:ring-sky-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setActiveField('password')}
                    onBlur={() => setActiveField(null)}
                    className="pl-10 pr-10 rounded-2xl border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/25 dark:focus:border-sky-400 dark:focus:ring-sky-500/20"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-pink-500 dark:hover:text-pink-400"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isOwnerSetup && recaptchaSiteKey && (
                <div className="flex justify-center pt-1">
                  <div ref={recaptchaRef} />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 h-11 w-full rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-rose-400 hover:from-sky-500 hover:via-pink-600 hover:to-rose-500 text-white font-bold shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/35 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isOwnerSetup ? 'Initializing Master Owner...' : 'Creating your account...'}</span>
                  </>
                ) : isOwnerSetup ? (
                  'Initialize Master Owner'
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-pink-100 dark:bg-pink-950/60" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">
                or continue with
              </span>
              <span className="h-px flex-1 bg-pink-100 dark:bg-pink-950/60" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={googleLoading}
              onClick={continueWithGoogle}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border-slate-200/80 bg-white/70 font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:border-pink-300 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-pink-500/40"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                  <span>Checking configuration...</span>
                </>
              ) : (
                <>
                  <GoogleLogo className="h-4 w-4" />
                  <span>Google Account</span>
                </>
              )}
            </Button>

            <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-pink-500 hover:underline dark:text-pink-400">
                Sign in
              </Link>
            </p>
          </Card>
          {/* Desktop Companion: Positioned cleanly to the right of the centered form */}
          <div className="hidden lg:block absolute left-[calc(100%+3.5rem)] top-[55%] -translate-y-1/2">
            <ByteAuthCompanion
              mood={mascotMood}
              errorMessage={error}
              bubblePlacement="right"
              size={115}
            />
          </div>
        </div>
      </div>

      <GoogleSetupModal isOpen={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
    </main>
  )
}
