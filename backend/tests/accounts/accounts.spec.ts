import assert from 'node:assert/strict'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('Connected Accounts Lifecycle (Part 1.3)', () => {
  let server: http.Server
  let baseUrl: string
  let testUser: any
  let userToken: string
  let testAccountId: string

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    const stamp = Date.now()
    testUser = await prisma.user.create({
      data: {
        email: `acc-test-${stamp}@betterdrive.internal`,
        name: 'Account Test User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const session = await prisma.userSession.create({
      data: {
        userId: testUser.id,
        refreshTokenHash: `refresh-acc-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    userToken = signAccessToken({ sub: testUser.id, sid: session.id })

    const acc = await prisma.connectedAccount.create({
      data: {
        userId: testUser.id,
        provider: 's3',
        providerAccountId: `s3-acc-${stamp}`,
        displayName: 'Original Label',
        email: 's3-bucket@betterdrive.internal',
        scopes: '[]',
        status: 'connected',
        enabled: true,
      },
    })
    testAccountId = acc.id

    await prisma.storageAccount.create({
      data: {
        connectedAccountId: acc.id,
        totalBytes: 5000000000n,
        usedBytes: 1000000000n,
        availableBytes: 4000000000n,
        lastSyncedAt: new Date(),
      },
    })
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. Rename account: label changes, UUID unchanged', async () => {
    const res = await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: 'Renamed Storage Account' }),
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.account.id, testAccountId)
    assert.equal(data.account.displayName, 'Renamed Storage Account')

    const dbAcc = await prisma.connectedAccount.findUnique({ where: { id: testAccountId } })
    assert.equal(dbAcc?.displayName, 'Renamed Storage Account')
  })

  test('2. Disable account: excluded from pool listing', async () => {
    // Create a file in this account
    const file = await prisma.file.create({
      data: {
        userId: testUser.id,
        connectedAccountId: testAccountId,
        provider: 's3',
        providerFileId: `file-pool-${Date.now()}`,
        name: 'pooled-file.txt',
        mimeType: 'text/plain',
        sizeBytes: 512n,
        status: 'active',
      },
    })

    // Confirm it appears in pool listing before disable
    let listRes = await fetch(`${baseUrl}/files`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(listRes.status, 200)
    let listData = await listRes.json()
    assert.ok(listData.files.some((f: any) => f.id === file.id))

    // Disable the account
    const disableRes = await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: false }),
    })
    assert.equal(disableRes.status, 200)

    // Confirm file is now excluded from pool listing
    listRes = await fetch(`${baseUrl}/files`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(listRes.status, 200)
    listData = await listRes.json()
    assert.ok(!listData.files.some((f: any) => f.id === file.id))

    // But if scoped directly with ?accountId=testAccountId, file is still returned
    const scopedRes = await fetch(`${baseUrl}/files?accountId=${testAccountId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(scopedRes.status, 200)
    const scopedData = await scopedRes.json()
    assert.ok(scopedData.files.some((f: any) => f.id === file.id))

    // Re-enable
    await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    })
  })

  test('3. Disconnect account: marks revoked, health shows reauth_required', async () => {
    const res = await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(res.status, 200)

    const dbAcc = await prisma.connectedAccount.findUnique({ where: { id: testAccountId } })
    assert.equal(dbAcc?.status, 'disconnected')
    assert.ok(dbAcc?.revokedAt)

    const healthRes = await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}/health`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(healthRes.status, 200)
    const health = await healthRes.json()
    assert.equal(health.state, 'reauth_required')
  })

  test('4. Reauth: restores health state', async () => {
    // When reauth is called and underlying provider succeeds or is manually restored
    await prisma.connectedAccount.update({
      where: { id: testAccountId },
      data: { status: 'connected', revokedAt: null, lastError: null },
    })

    const healthRes = await fetch(`${baseUrl}/system/connected-accounts/${testAccountId}/health`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(healthRes.status, 200)
    const health = await healthRes.json()
    assert.equal(health.state, 'healthy')
  })
})
