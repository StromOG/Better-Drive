import { env } from '../../config/env.js'
import { prisma } from '../../config/prisma.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { createAuditLog } from '../../utils/audit.js'
import { hashToken, randomToken } from '../../utils/crypto.js'

export function computeInvitationStatus(inv: {
  acceptedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}): 'pending' | 'accepted' | 'revoked' | 'expired' {
  if (inv.acceptedAt) return 'accepted'
  if (inv.revokedAt) return 'revoked'
  if (new Date() > inv.expiresAt) return 'expired'
  return 'pending'
}

export function serializeInvitation(inv: {
  id: string
  email: string
  role: string
  invitedById: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  invitedBy?: { id: string; name: string; email: string } | null
}) {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: computeInvitationStatus(inv),
    invitedById: inv.invitedById,
    invitedBy: inv.invitedBy ?? null,
    expiresAt: inv.expiresAt.toISOString(),
    acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    revokedAt: inv.revokedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
  }
}

export async function createInvitation(
  actorUserId: string,
  actorRole: string,
  email: string,
  role: 'admin' | 'member',
  ip?: string,
) {
  const normalizedEmail = email.trim().toLowerCase()

  if (role !== 'admin' && role !== 'member') {
    throw HttpError.badRequest('Invalid role. Only admin and member can be invited.', 'BAD_REQUEST')
  }

  if (role === 'admin' && actorRole !== 'owner') {
    throw new HttpError(
      403,
      'INVITATION_ADMIN_REQUIRES_OWNER',
      'Only the owner can create administrator invitations.',
    )
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existingUser) {
    throw HttpError.conflict('A user with this email address already exists.', 'USER_EXISTS')
  }

  // Revoke any previous pending invitations for this email
  await prisma.invitation.updateMany({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })

  const token = randomToken(32)
  const tokenHash = hashToken(token)
  const ttlHours = env.INVITATION_TTL_HOURS || 168
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      role,
      tokenHash,
      invitedById: actorUserId,
      expiresAt,
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  })

  await createAuditLog(actorUserId, 'member.invitation_created', 'invitation', invitation.id, {
    email: normalizedEmail,
    role,
    expiresAt: expiresAt.toISOString(),
    ip,
  })

  const url = `${env.APP_URL.replace(/\/+$/, '')}/invitations/${token}/accept`

  return {
    invitation: serializeInvitation(invitation),
    token,
    url,
  }
}

export async function listInvitations() {
  const invitations = await prisma.invitation.findMany({
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return invitations.map(serializeInvitation)
}

export async function revokeInvitation(actorUserId: string, invitationId: string, ip?: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  })

  if (!invitation) {
    throw new HttpError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.')
  }

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  })

  await createAuditLog(actorUserId, 'member.invitation_revoked', 'invitation', invitationId, {
    email: invitation.email,
    ip,
  })

  return serializeInvitation(updated)
}

export async function acceptInvitation(
  userId: string,
  userEmail: string,
  rawToken: string,
  ip?: string,
) {
  const tokenHash = hashToken(rawToken)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
  })

  if (!invitation) {
    throw new HttpError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.')
  }

  if (invitation.revokedAt) {
    throw new HttpError(404, 'INVITATION_NOT_FOUND', 'Invitation has been revoked.')
  }

  if (invitation.acceptedAt) {
    throw new HttpError(
      409,
      'INVITATION_ALREADY_ACCEPTED',
      'This invitation has already been accepted.',
    )
  }

  if (new Date() > invitation.expiresAt) {
    throw new HttpError(410, 'INVITATION_EXPIRED', 'This invitation has expired.')
  }

  if (invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    throw new HttpError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'The invitation was issued to a different email address.',
    )
  }

  const now = new Date()
  const [updatedUser, updatedInvitation] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role: invitation.role },
      select: { id: true, email: true, role: true, status: true },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ])

  await createAuditLog(userId, 'member.invitation_accepted', 'invitation', invitation.id, {
    role: invitation.role,
    ip,
  })

  return {
    user: updatedUser,
    invitation: serializeInvitation(updatedInvitation),
  }
}
