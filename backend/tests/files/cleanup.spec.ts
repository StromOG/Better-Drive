import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('Duplicate Cleaner Rails & Audit Log (Part 3)', () => {
  let server: http.Server
  let baseUrl: string
  let testUserId: string
  let testSessionId: string
  let testToken: string
  let testAccountId: string
  const createdFileIds: string[] = []

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    let user = await prisma.user.findFirst({ where: { email: 'cleanup-test@betterdrive.internal' } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'cleanup-test@betterdrive.internal',
          name: 'Cleanup Test User',
          passwordHash: 'dummy-hash',
          role: 'user',
          status: 'active',
        },
      })
    }
    testUserId = user.id

    let acc = await prisma.connectedAccount.findFirst({
      where: { userId: testUserId, provider: 's3' },
    })
    if (!acc) {
      acc = await prisma.connectedAccount.create({
        data: {
          userId: testUserId,
          provider: 's3',
          providerAccountId: 's3-cleanup-123',
          email: 's3-cleanup@betterdrive.internal',
          scopes: '[]',
          status: 'connected',
        },
      })
    }
    testAccountId = acc.id

    const session = await prisma.userSession.create({
      data: {
        userId: testUserId,
        refreshTokenHash: 'dummy-refresh-hash',
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    testSessionId = session.id
    testToken = signAccessToken({ sub: testUserId, sid: testSessionId })

    // Clean up any stale audit rows from interrupted runs
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } })

    // Seed 3 duplicate groups:
    // Group 1: 2 files with checksum1 (size 100)
    // Group 2: 3 files with checksum2 (size 200)
    // Group 3: 2 files with checksum3 (size 300)
    const seedGroup = async (prefix: string, count: number, size: number) => {
      const checksum = crypto.createHash('sha256').update(`seed-content-${prefix}`).digest('hex')
      for (let i = 0; i < count; i++) {
        const file = await prisma.file.create({
          data: {
            userId: testUserId,
            connectedAccountId: testAccountId,
            provider: 's3',
            providerFileId: `provider-${prefix}-${i}`,
            name: `${prefix}-file-${i}.bin`,
            mimeType: 'application/octet-stream',
            sizeBytes: BigInt(size),
            checksum,
            status: 'active',
            createdAt: new Date(Date.now() - (1000 - i * 100)), // older files have smaller timestamps
          },
        })
        createdFileIds.push(file.id)
      }
    }

    await seedGroup('groupA', 2, 100)
    await seedGroup('groupB', 3, 200)
    await seedGroup('groupC', 2, 300)
  })

  after(async () => {
    if (createdFileIds.length > 0) {
      await prisma.file.deleteMany({ where: { id: { in: createdFileIds } } })
    }
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } })
    await prisma.userSession.deleteMany({ where: { id: testSessionId } })
    server.closeAllConnections?.()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. Dry-run with three duplicate groups returns correct count and does not modify anything', async () => {
    const res = await fetch(`${baseUrl}/files/duplicates/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({ keep: 'oldest', dryRun: true }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.success, true)
    assert.equal(json.dryRun, true)
    // Group 1 has 1 duplicate, Group 2 has 2 duplicates, Group 3 has 1 duplicate -> total 4 duplicates to remove
    assert.equal(json.deleted, 4)
    assert.equal(json.files.length, 4)

    // Assert files are still active in database
    const activeCount = await prisma.file.count({
      where: { id: { in: createdFileIds }, status: 'active' },
    })
    assert.equal(activeCount, 7)
  })

  test('2. Execute with dryRun: false moves files to trash, never permanent delete', async () => {
    const res = await fetch(`${baseUrl}/files/duplicates/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({ keep: 'oldest', dryRun: false }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.success, true)
    assert.equal(json.dryRun, false)
    assert.equal(json.deleted, 4)

    // Verify 3 original files remain active
    const activeFiles = await prisma.file.findMany({
      where: { id: { in: createdFileIds }, status: 'active' },
    })
    assert.equal(activeFiles.length, 3)

    // Verify 4 duplicate files are in trash (status = 'deleted' with deletedAt set)
    const trashedFiles = await prisma.file.findMany({
      where: { id: { in: createdFileIds }, status: 'deleted' },
    })
    assert.equal(trashedFiles.length, 4)
    for (const file of trashedFiles) {
      assert.ok(file.deletedAt instanceof Date)
      assert.ok(file.providerFileId) // Provider object was NOT permanently destroyed
    }
  })

  test('3. Audit log has one row per trashed file with required fields', async () => {
    const auditRows = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        action: 'file.duplicate_cleaned',
      },
    })

    assert.equal(auditRows.length, 4)
    for (const row of auditRows) {
      assert.ok(row.metadata)
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      assert.ok(meta.fileId)
      assert.ok(meta.name)
      assert.ok(meta.path)
      assert.ok(meta.size)
      assert.ok(meta.checksum)
      assert.ok(meta.dedupedAgainstFileId)
      assert.equal(meta.actorUserId, testUserId)
    }
  })

  test('4. Empty duplicate set returns { deleted: 0 }, no error', async () => {
    const res = await fetch(`${baseUrl}/files/duplicates/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({ keep: 'oldest', dryRun: false }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.success, true)
    assert.equal(json.deleted, 0)
    assert.equal(json.files.length, 0)
  })
})
