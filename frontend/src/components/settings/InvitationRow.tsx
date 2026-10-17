import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from './ConfirmationDialog'

export interface InvitationRecord {
  id: string
  email: string
  role: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  invitedBy?: { id: string; name: string; email: string } | null
  expiresAt: string
  acceptedAt?: string | null
  revokedAt?: string | null
  createdAt: string
  token?: string
}

export interface InvitationRowProps {
  invitation: InvitationRecord
  onRevoke: (id: string) => Promise<void>
}

export function InvitationRow({ invitation, onRevoke }: InvitationRowProps) {
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const isPending = invitation.status === 'pending'

  const handleConfirmRevoke = async () => {
    setIsProcessing(true)
    try {
      await onRevoke(invitation.id)
    } finally {
      setIsProcessing(false)
      setIsRevokeConfirmOpen(false)
    }
  }

  const getStatusBadge = () => {
    switch (invitation.status) {
      case 'accepted':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
      case 'expired':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      case 'revoked':
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
    }
  }

  return (
    <>
      <tr className="border-b border-neutral-100 dark:border-neutral-800/80 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition">
        <td className="py-3 px-4 font-medium text-sm text-neutral-900 dark:text-neutral-100">
          {invitation.email}
        </td>
        <td className="py-3 px-4">
          <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            {invitation.role}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-medium capitalize ${getStatusBadge()}`}>
            {invitation.status}
          </span>
        </td>
        <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-400">
          {invitation.invitedBy?.name || invitation.invitedBy?.email || 'System'}
        </td>
        <td className="py-3 px-4 text-xs text-neutral-500 dark:text-neutral-400">
          {new Date(invitation.expiresAt).toLocaleDateString()}
        </td>
        <td className="py-3 px-4 text-right">
          {isPending && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRevokeConfirmOpen(true)}
              aria-label={`Revoke invitation for ${invitation.email}`}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 h-8 px-2.5 text-xs"
            >
              <XCircle className="w-4 h-4 mr-1" />
              <span>Revoke</span>
            </Button>
          )}
        </td>
      </tr>

      <ConfirmationDialog
        isOpen={isRevokeConfirmOpen}
        title="Revoke Invitation"
        description={`Are you sure you want to revoke the invitation for ${invitation.email}? The recipient will no longer be able to use the link to join.`}
        confirmLabel="Revoke Invitation"
        isDestructive={true}
        isLoading={isProcessing}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setIsRevokeConfirmOpen(false)}
      />
    </>
  )
}
