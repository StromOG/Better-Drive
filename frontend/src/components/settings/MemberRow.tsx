import { useState } from 'react'
import { Shield, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/select'
import { ConfirmationDialog } from './ConfirmationDialog'

export interface MemberRecord {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'disabled'
  joinedAt: string
  lastActiveAt: string
}

export interface MemberRowProps {
  member: MemberRecord
  currentUserId: string
  currentUserRole: string
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onChangeRole: (id: string, newRole: 'admin' | 'member') => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function MemberRow({
  member,
  currentUserId,
  currentUserRole,
  isSelected,
  onToggleSelect,
  onChangeRole,
  onRemove,
}: MemberRowProps) {
  const [roleChangeTarget, setRoleChangeTarget] = useState<'admin' | 'member' | null>(null)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const isSelf = member.id === currentUserId
  const isOwner = member.role === 'owner'
  const isTargetAdmin = member.role === 'admin'
  const canModify =
    !isSelf &&
    !isOwner &&
    (currentUserRole === 'owner' || (currentUserRole === 'admin' && !isTargetAdmin))

  const handleRoleSelect = (val: string) => {
    if (val !== member.role) {
      setRoleChangeTarget(val as 'admin' | 'member')
    }
  }

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return
    setIsProcessing(true)
    try {
      await onChangeRole(member.id, roleChangeTarget)
    } finally {
      setIsProcessing(false)
      setRoleChangeTarget(null)
    }
  }

  const handleConfirmRemove = async () => {
    setIsProcessing(true)
    try {
      await onRemove(member.id)
    } finally {
      setIsProcessing(false)
      setIsRemoveConfirmOpen(false)
    }
  }

  return (
    <>
      <tr className="border-b border-neutral-100 dark:border-neutral-800/80 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition">
        <td className="py-3 px-4 w-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(member.id)}
            disabled={!canModify}
            aria-label={`Select ${member.name || member.email}`}
            className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:opacity-30 cursor-pointer"
          />
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 font-semibold text-xs">
              {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <span>{member.name || 'Unnamed Member'}</span>
                {isSelf && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-normal">
                    You
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{member.email}</div>
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          {canModify ? (
            <div className="w-28">
              <CustomSelect
                size="sm"
                value={member.role}
                onChange={handleRoleSelect}
                disabled={isProcessing}
                options={[
                  { value: 'member', label: 'Member' },
                  ...(currentUserRole === 'owner' ? [{ value: 'admin', label: 'Admin' }] : []),
                ]}
              />
            </div>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                member.role === 'owner'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : member.role === 'admin'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {member.role === 'owner' && <Shield className="w-3 h-3" />}
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            </span>
          )}
        </td>
        <td className="py-3 px-4">
          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              member.status === 'active'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
            }`}
          >
            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
          </span>
        </td>
        <td className="py-3 px-4 text-xs text-neutral-500 dark:text-neutral-400">
          {new Date(member.joinedAt).toLocaleDateString()}
        </td>
        <td className="py-3 px-4 text-xs text-neutral-500 dark:text-neutral-400">
          {new Date(member.lastActiveAt).toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right">
          {canModify && member.status === 'active' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRemoveConfirmOpen(true)}
              aria-label={`Remove member ${member.email}`}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 h-8 px-2"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </td>
      </tr>

      <ConfirmationDialog
        isOpen={Boolean(roleChangeTarget)}
        title="Confirm Role Change"
        description={`Are you sure you want to change ${member.name || member.email}'s role to ${roleChangeTarget}?`}
        confirmLabel="Update Role"
        isDestructive={false}
        isLoading={isProcessing}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setRoleChangeTarget(null)}
      />

      <ConfirmationDialog
        isOpen={isRemoveConfirmOpen}
        title="Remove Member"
        description={`Are you sure you want to remove ${member.name || member.email}? Their account and sessions will be disabled, but all their stored files will be safely retained.`}
        confirmLabel="Remove Member"
        isDestructive={true}
        isLoading={isProcessing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setIsRemoveConfirmOpen(false)}
      />
    </>
  )
}
