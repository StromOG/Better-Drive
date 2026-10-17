import { prisma } from '../../config/prisma.js'
import { HttpError } from '../../middleware/error.middleware.js'
import { createAuditLog } from '../../utils/audit.js'

export async function listMembers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      gravatarEnabled: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    gravatarEnabled: u.gravatarEnabled,
    joinedAt: u.createdAt.toISOString(),
    lastActiveAt: u.sessions[0]?.createdAt.toISOString() ?? u.updatedAt.toISOString(),
    createdAt: u.createdAt.toISOString(),
  }))
}

export async function changeMemberRole(
  actorUserId: string,
  actorRole: string,
  targetUserId: string,
  newRole: 'owner' | 'admin' | 'member',
  ip?: string,
) {
  if (actorUserId === targetUserId) {
    throw new HttpError(400, 'MEMBER_CANNOT_CHANGE_OWN_ROLE', 'Cannot change your own role.')
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!target) {
    throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found.')
  }

  if (target.role === 'owner' && newRole !== 'owner') {
    const ownerCount = await prisma.user.count({
      where: { role: 'owner', status: 'active' },
    })
    if (ownerCount <= 1) {
      throw new HttpError(
        400,
        'MEMBER_CANNOT_REMOVE_LAST_OWNER',
        'Cannot demote the last remaining owner.',
      )
    }
  }

  // Owner-only for admin / owner changes
  if (actorRole !== 'owner') {
    if (target.role === 'admin' || target.role === 'owner' || newRole === 'admin' || newRole === 'owner') {
      throw new HttpError(
        403,
        'FORBIDDEN_OWNER_ONLY',
        'Only owners can assign or change administrator roles.',
      )
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await createAuditLog(actorUserId, 'member.role_changed', 'user', targetUserId, {
    oldRole: target.role,
    newRole,
    ip,
  })

  return updated
}

export async function removeMember(
  actorUserId: string,
  actorRole: string,
  targetUserId: string,
  ip?: string,
) {
  if (actorUserId === targetUserId) {
    throw new HttpError(400, 'MEMBER_CANNOT_CHANGE_OWN_ROLE', 'Cannot remove yourself.')
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!target) {
    throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found.')
  }

  if (target.role === 'owner') {
    throw new HttpError(400, 'MEMBER_CANNOT_REMOVE_LAST_OWNER', 'Cannot remove an owner.')
  }

  if (actorRole !== 'owner' && target.role === 'admin') {
    throw new HttpError(403, 'FORBIDDEN_OWNER_ONLY', 'Only owners can remove administrators.')
  }

  // Soft-delete user and revoke sessions, keep files intact
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'disabled' },
    }),
    prisma.userSession.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await createAuditLog(actorUserId, 'member.removed', 'user', targetUserId, {
    email: target.email,
    ip,
  })

  return { status: 'ok' }
}

export async function bulkChangeRole(
  actorUserId: string,
  actorRole: string,
  userIds: string[],
  role: 'admin' | 'member',
  ip?: string,
) {
  if (actorRole !== 'owner') {
    throw new HttpError(
      403,
      'FORBIDDEN_OWNER_ONLY',
      'Only owners can perform bulk role changes.',
    )
  }

  // Do not change own role
  const filteredIds = userIds.filter((id) => id !== actorUserId)
  if (filteredIds.length === 0) {
    return { updatedCount: 0 }
  }

  const result = await prisma.user.updateMany({
    where: {
      id: { in: filteredIds },
      status: { not: 'disabled' },
    },
    data: { role },
  })

  await createAuditLog(actorUserId, 'member.bulk_role_changed', 'user', undefined, {
    userIds: filteredIds,
    role,
    count: result.count,
    ip,
  })

  return { updatedCount: result.count }
}

export async function bulkDisableMembers(
  actorUserId: string,
  actorRole: string,
  userIds: string[],
  ip?: string,
) {
  // Exclude self and any owner
  const targets = await prisma.user.findMany({
    where: {
      id: { in: userIds.filter((id) => id !== actorUserId) },
      role: { not: 'owner' },
      status: { not: 'disabled' },
    },
    select: { id: true, role: true },
  })

  const eligibleIds = targets
    .filter((t) => actorRole === 'owner' || t.role !== 'admin')
    .map((t) => t.id)

  if (eligibleIds.length === 0) {
    return { disabledCount: 0 }
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: eligibleIds } },
      data: { status: 'disabled' },
    }),
    prisma.userSession.updateMany({
      where: { userId: { in: eligibleIds }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await createAuditLog(actorUserId, 'member.bulk_disabled', 'user', undefined, {
    userIds: eligibleIds,
    count: eligibleIds.length,
    ip,
  })

  return { disabledCount: eligibleIds.length }
}
