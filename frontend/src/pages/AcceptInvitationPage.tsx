import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/drive/BrandLogo'
import { apiFetch } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const user = getStoredUser()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedRole, setAcceptedRole] = useState<string | null>(null)

  const handleAccept = async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ user: { id: string; role: string } }>(
        `/invitations/${token}/accept`,
        { method: 'POST' },
      )
      setAcceptedRole(data.user.role)
      setTimeout(() => {
        navigate('/all-files')
      }, 2000)
    } catch (err: any) {
      if (err?.code === 'INVITATION_EMAIL_MISMATCH') {
        setError(
          'Email mismatch: This invitation was sent to a different email address than your current logged-in account.',
        )
      } else if (err?.code === 'INVITATION_EXPIRED') {
        setError('This invitation link has expired. Please ask an administrator to send a new one.')
      } else if (err?.code === 'INVITATION_ALREADY_ACCEPTED') {
        setError('This invitation has already been accepted.')
      } else {
        setError(err?.message || 'Failed to accept invitation.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <BrandLogo className="h-10 w-10" />
        </div>

        {acceptedRole ? (
          <div className="space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Welcome to BetterDrive!
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Invitation accepted. Your role is now <span className="font-semibold capitalize">{acceptedRole}</span>.
              Redirecting you to your files...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                You've Been Invited
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Join this BetterDrive instance as an authorized team member.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {user ? (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300">
                  Signed in as <span className="font-semibold text-neutral-900 dark:text-neutral-100">{user.email}</span>
                </div>

                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={isLoading}
                  className="w-full h-10 text-sm font-medium"
                >
                  {isLoading ? 'Accepting...' : 'Accept Invitation & Join'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  You must be logged in with the invited email address to accept this invitation.
                </p>

                <div className="flex flex-col gap-2">
                  <Link to={`/login?redirect=/invitations/${token}/accept`}>
                    <Button type="button" className="w-full">
                      Log In to Accept
                    </Button>
                  </Link>
                  <Link to={`/register?redirect=/invitations/${token}/accept`}>
                    <Button type="button" variant="outline" className="w-full">
                      Register New Account
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
