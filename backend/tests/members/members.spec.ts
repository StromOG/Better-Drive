import assert from 'node:assert/strict'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('Member Invitations & Role Management (Part 1.1 & 1.2)', () => {
  let server: http.Server
  let baseUrl: string
  let ownerUser: any
  let adminUser: any
  let memberUser: any
  let otherUser: any
  let ownerToken: string
  let adminToken: string
  let _memberToken: string
  let otherToken: string

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    const stamp = Date.now()
    ownerUser = await prisma.user.create({
      data: {
        email: `owner-${stamp}@betterdrive.internal`,
        name: 'Owner User',
        passwordHash: 'dummy',
        role: 'owner',
        status: 'active',
      },
    })
    const ownerSession = await prisma.userSession.create({
      data: {
        userId: ownerUser.id,
        refreshTokenHash: `refresh-owner-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    ownerToken = signAccessToken({ sub: ownerUser.id, sid: ownerSession.id })

    adminUser = await prisma.user.create({
      data: {
        email: `admin-${stamp}@betterdrive.internal`,
        name: 'Admin User',
        passwordHash: 'dummy',
        role: 'admin',
        status: 'active',
      },
    })
    const adminSession = await prisma.userSession.create({
      data: {
        userId: adminUser.id,
        refreshTokenHash: `refresh-admin-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    adminToken = signAccessToken({ sub: adminUser.id, sid: adminSession.id })

    memberUser = await prisma.user.create({
      data: {
        email: `member-${stamp}@betterdrive.internal`,
        name: 'Member User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const memberSession = await prisma.userSession.create({
      data: {
        userId: memberUser.id,
        refreshTokenHash: `refresh-member-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    _memberToken = signAccessToken({ sub: memberUser.id, sid: memberSession.id })

    otherUser = await prisma.user.create({
      data: {
        email: `other-${stamp}@betterdrive.internal`,
        name: 'Other User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const otherSession = await prisma.userSession.create({
      data: {
        userId: otherUser.id,
        refreshTokenHash: `refresh-other-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    otherToken = signAccessToken({ sub: otherUser.id, sid: otherSession.id })
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. Invite member as owner: succeeds', async () => {
    const res = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'new-invitee@betterdrive.internal',
        role: 'member',
      }),
    })
    assert.equal(res.status, 201)
    const data = await res.json()
    assert.equal(data.invitation.email, 'new-invitee@betterdrive.internal')
    assert.equal(data.invitation.role, 'member')
    assert.ok(data.token)
    assert.ok(data.url)
  })

  test('2. Invite admin as admin: fails with INVITATION_ADMIN_REQUIRES_OWNER', async () => {
    const res = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'another-admin@betterdrive.internal',
        role: 'admin',
      }),
    })
    assert.equal(res.status, 403)
    const data = await res.json()
    assert.equal(data.code, 'INVITATION_ADMIN_REQUIRES_OWNER')
  })

  test('3. Invite with email that already exists: fails', async () => {
    const res = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: memberUser.email,
        role: 'member',
      }),
    })
    assert.equal(res.status, 409)
  })

  test('4. Accept invitation with matching email: succeeds, role applied', async () => {
    const targetEmail = `accept-test-${Date.now()}@betterdrive.internal`
    const createRes = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: targetEmail,
        role: 'admin',
      }),
    })
    assert.equal(createRes.status, 201)
    const { token } = await createRes.json()

    // Create candidate user with that email
    const candidateUser = await prisma.user.create({
      data: {
        email: targetEmail,
        name: 'Candidate User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const candidateSession = await prisma.userSession.create({
      data: {
        userId: candidateUser.id,
        refreshTokenHash: `refresh-cand-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    const candidateToken = signAccessToken({ sub: candidateUser.id, sid: candidateSession.id })

    const acceptRes = await fetch(`${baseUrl}/invitations/${token}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${candidateToken}`,
      },
    })
    assert.equal(acceptRes.status, 200)
    const acceptData = await acceptRes.json()
    assert.equal(acceptData.user.role, 'admin')

    const dbUser = await prisma.user.findUnique({ where: { id: candidateUser.id } })
    assert.equal(dbUser?.role, 'admin')
  })

  test('5. Accept with wrong email: fails with INVITATION_EMAIL_MISMATCH', async () => {
    const inviteRes = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'specific-person@betterdrive.internal',
        role: 'member',
      }),
    })
    const { token } = await inviteRes.json()

    const acceptRes = await fetch(`${baseUrl}/invitations/${token}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    })
    assert.equal(acceptRes.status, 403)
    const data = await acceptRes.json()
    assert.equal(data.code, 'INVITATION_EMAIL_MISMATCH')
  })

  test('6. Accept expired invitation: fails', async () => {
    const expiredEmail = `expired-${Date.now()}@betterdrive.internal`
    const crypto = await import('node:crypto')
    const rawTok = `plain-expired-token-${Date.now()}`
    const th = crypto.createHash('sha256').update(rawTok).digest('hex')

    await prisma.invitation.create({
      data: {
        email: expiredEmail,
        role: 'member',
        tokenHash: th,
        invitedById: ownerUser.id,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    })

    const expUser = await prisma.user.create({
      data: {
        email: expiredEmail,
        name: 'Expired User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const expSession = await prisma.userSession.create({
      data: {
        userId: expUser.id,
        refreshTokenHash: `refresh-exp-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    const expToken = signAccessToken({ sub: expUser.id, sid: expSession.id })

    const acceptRes = await fetch(`${baseUrl}/invitations/${rawTok}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expToken}`,
      },
    })
    assert.equal(acceptRes.status, 410)
    const data = await acceptRes.json()
    assert.equal(data.code, 'INVITATION_EXPIRED')
  })

  test('7. Revoke invitation: subsequent accept fails', async () => {
    const revokeEmail = `to-revoke-${Date.now()}@betterdrive.internal`
    const inviteRes = await fetch(`${baseUrl}/system/members/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: revokeEmail,
        role: 'member',
      }),
    })
    const { invitation, token } = await inviteRes.json()

    const revokeRes = await fetch(`${baseUrl}/system/members/invitations/${invitation.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    })
    assert.equal(revokeRes.status, 200)

    const revUser = await prisma.user.create({
      data: {
        email: revokeEmail,
        name: 'Revoked Invitee',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const revSession = await prisma.userSession.create({
      data: {
        userId: revUser.id,
        refreshTokenHash: `refresh-rev-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    const revToken = signAccessToken({ sub: revUser.id, sid: revSession.id })

    const acceptRes = await fetch(`${baseUrl}/invitations/${token}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${revToken}`,
      },
    })
    assert.equal(acceptRes.status, 404)
    const data = await acceptRes.json()
    assert.equal(data.code, 'INVITATION_NOT_FOUND')
  })

  test('8. Change role: owner changes member to admin, succeeds', async () => {
    const res = await fetch(`${baseUrl}/system/members/${memberUser.id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.member.role, 'admin')
  })

  test('9. Change own role: fails with MEMBER_CANNOT_CHANGE_OWN_ROLE', async () => {
    const res = await fetch(`${baseUrl}/system/members/${ownerUser.id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    })
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.equal(data.code, 'MEMBER_CANNOT_CHANGE_OWN_ROLE')
  })

  test('10. Remove last owner: fails with MEMBER_CANNOT_REMOVE_LAST_OWNER', async () => {
    const res = await fetch(`${baseUrl}/system/members/${ownerUser.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.equal(data.code, 'MEMBER_CANNOT_REMOVE_LAST_OWNER')
  })

  test('11. Remove member: soft-deletes, files remain', async () => {
    // Create member with an active file
    const removee = await prisma.user.create({
      data: {
        email: `removee-${Date.now()}@betterdrive.internal`,
        name: 'Removee User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })

    const acc = await prisma.connectedAccount.create({
      data: {
        userId: removee.id,
        provider: 's3',
        providerAccountId: `s3-${Date.now()}`,
        email: removee.email,
        scopes: '[]',
        status: 'connected',
      },
    })

    const file = await prisma.file.create({
      data: {
        userId: removee.id,
        connectedAccountId: acc.id,
        provider: 's3',
        providerFileId: `pfile-${Date.now()}`,
        name: 'important-file.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024n,
        status: 'active',
      },
    })

    const res = await fetch(`${baseUrl}/system/members/${removee.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    })
    assert.equal(res.status, 200)

    const updatedUser = await prisma.user.findUnique({ where: { id: removee.id } })
    assert.equal(updatedUser?.status, 'disabled')

    // Confirm file is still present
    const checkFile = await prisma.file.findUnique({ where: { id: file.id } })
    assert.ok(checkFile)
    assert.equal(checkFile.name, 'important-file.txt')
  })
})
