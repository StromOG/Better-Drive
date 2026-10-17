import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  UserPlus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CustomSelect } from '@/components/ui/select'
import { MemberRow, type MemberRecord } from '@/components/settings/MemberRow'
import { InvitationRow, type InvitationRecord } from '@/components/settings/InvitationRow'
import { apiFetch } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

export function MembersPage() {
  const currentUser = getStoredUser()
  const isOwner = currentUser?.role === 'owner'

  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members')
  const [members, setMembers] = useState<MemberRecord[]>([])
  const [invitations, setInvitations] = useState<InvitationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Bulk actions state
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [membersData, invitesData] = await Promise.all([
        apiFetch<{ members: MemberRecord[] }>('/system/members').catch(() => ({ members: [] })),
        apiFetch<{ invitations: InvitationRecord[] }>('/system/members/invitations').catch(() => ({
          invitations: [],
        })),
      ])
      setMembers(membersData.members)
      setInvitations(invitesData.invitations)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggleSelectAll = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(
        members
          .filter((m) => m.id !== currentUser?.id && m.role !== 'owner')
          .map((m) => m.id),
      )
    }
  }

  const handleToggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleChangeRole = async (targetUserId: string, newRole: 'admin' | 'member') => {
    await apiFetch(`/system/members/${targetUserId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    })
    await fetchData()
  }

  const handleRemoveMember = async (targetUserId: string) => {
    await apiFetch(`/system/members/${targetUserId}`, {
      method: 'DELETE',
    })
    setSelectedMemberIds((prev) => prev.filter((id) => id !== targetUserId))
    await fetchData()
  }

  const handleRevokeInvitation = async (id: string) => {
    await apiFetch(`/system/members/invitations/${id}`, {
      method: 'DELETE',
    })
    await fetchData()
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    setInviteError(null)
    try {
      const data = await apiFetch<{ invitation: InvitationRecord; token: string; url: string }>(
        '/system/members/invitations',
        {
          method: 'POST',
          body: JSON.stringify({
            email: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          }),
        },
      )
      setCreatedInviteUrl(data.url)
      setInvitations((prev) => [data.invitation, ...prev])
      setInviteEmail('')
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to create invitation.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleCopyInviteUrl = async () => {
    if (!createdInviteUrl) return
    try {
      await navigator.clipboard.writeText(createdInviteUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // fallback
    }
  }

  const handleBulkChangeRole = async (role: 'admin' | 'member') => {
    if (selectedMemberIds.length === 0) return
    setIsBulkLoading(true)
    try {
      await apiFetch('/system/members/bulk-role', {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedMemberIds, role }),
      })
      await fetchData()
      setSelectedMemberIds([])
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkDisable = async () => {
    if (selectedMemberIds.length === 0) return
    setIsBulkLoading(true)
    try {
      await apiFetch('/system/members/bulk-disable', {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedMemberIds }),
      })
      await fetchData()
      setSelectedMemberIds([])
    } finally {
      setIsBulkLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--card-border)]">
        <div>
          <h2 className="text-lg font-black text-[var(--app-text)]">Team & Access</h2>
          <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
            Manage members, assign administrative privileges, and issue invitations.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setIsInviteModalOpen(true)
            setCreatedInviteUrl(null)
            setInviteError(null)
          }}
          className="flex items-center gap-2 text-xs font-bold"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Sub-tabs: Members vs Invitations */}
      <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'members'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          Members ({members.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition ${
            activeTab === 'invitations'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          Invitations ({invitations.filter((i) => i.status === 'pending').length} pending)
        </button>
      </div>

      {activeTab === 'members' ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          {/* Bulk Action Bar */}
          {selectedMemberIds.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
              <span className="font-medium">
                {selectedMemberIds.length} member{selectedMemberIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBulkLoading}
                      onClick={() => handleBulkChangeRole('admin')}
                      className="h-7 text-xs"
                    >
                      Make Admin
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBulkLoading}
                      onClick={() => handleBulkChangeRole('member')}
                      className="h-7 text-xs"
                    >
                      Make Member
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isBulkLoading}
                  onClick={handleBulkDisable}
                  className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  Disable Selected
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No members found in this instance.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.length > 0 && selectedMemberIds.length === members.filter((m) => m.id !== currentUser?.id && m.role !== 'owner').length}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all members"
                        className="rounded border-neutral-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      currentUserId={currentUser?.id || ''}
                      currentUserRole={currentUser?.role || 'member'}
                      isSelected={selectedMemberIds.includes(member.id)}
                      onToggleSelect={handleToggleSelectMember}
                      onChangeRole={handleChangeRole}
                      onRemove={handleRemoveMember}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No active or historical invitations. Click "Invite Member" to invite a user.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => (
                    <InvitationRow
                      key={invitation.id}
                      invitation={invitation}
                      onRevoke={handleRevokeInvitation}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              aria-label="Close invite modal"
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Invite New Member
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Generate a secure, single-use invitation link for your instance.
                </p>
              </div>
            </div>

            {inviteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                {inviteError}
              </div>
            )}

            {!createdInviteUrl ? (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Recipient Email Address
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-bold text-[var(--app-text)] mb-1.5"
                  >
                    Assigned Role
                  </label>
                  <CustomSelect
                    value={inviteRole}
                    onChange={(val) => setInviteRole(val as 'admin' | 'member')}
                    options={[
                      {
                        value: 'member',
                        label: 'Member',
                        description: 'Standard cloud storage user (upload, view, organize files)',
                      },
                      ...(isOwner
                        ? [
                            {
                              value: 'admin',
                              label: 'Admin',
                              description: 'Can manage workspace members and storage connections',
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isInviting || !inviteEmail.trim()}>
                    {isInviting ? 'Generating...' : 'Create Invitation'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                  Invitation created successfully! Share this link with the recipient to let them join:
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Invitation URL
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={createdInviteUrl}
                      aria-label="Invitation Link"
                      className="font-mono text-xs select-all bg-neutral-50 dark:bg-neutral-950"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyInviteUrl}
                      className="flex-shrink-0 flex items-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-3">
                  <Button type="button" onClick={() => setIsInviteModalOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
