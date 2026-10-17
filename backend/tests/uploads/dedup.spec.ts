import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('Upload Deduplication (Model B Option A: Name & Folder Scoped)', () => {
  let server: http.Server
  let baseUrl: string
  let testUserId: string
  let testSessionId: string
  let testToken: string
  let testAccountId: string
  let testFolderId: string
  const createdFileIds: string[] = []

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    let user = await prisma.user.findFirst({ where: { email: 'dedup-test@betterdrive.internal' } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'dedup-test@betterdrive.internal',
          name: 'Dedup Test User',
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
          providerAccountId: 's3-test-123',
          email: 's3-account@betterdrive.internal',
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

    const folder = await prisma.folder.create({
      data: {
        name: 'Work',
        userId: testUserId,
        color: '#4F46E5',
      },
    })
    testFolderId = folder.id
  })

  after(async () => {
    if (createdFileIds.length > 0) {
      await prisma.file.deleteMany({ where: { id: { in: createdFileIds } } })
    }
    await prisma.folder.deleteMany({ where: { userId: testUserId } })
    await prisma.userSession.deleteMany({ where: { id: testSessionId } })
    server.closeAllConnections?.()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. First file upload registers active file row with checksum in root folder', async () => {
    const content = Buffer.from('identical-content-test-buffer-for-model-b')
    const checksum = crypto.createHash('sha256').update(content).digest('hex')

    const file1 = await prisma.file.create({
      data: {
        userId: testUserId,
        connectedAccountId: testAccountId,
        provider: 's3',
        providerFileId: 's3-mock-key-1',
        name: 'contract.pdf',
        folderId: null,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(content.length),
        checksum,
        status: 'active',
      },
    })
    createdFileIds.push(file1.id)

    assert.ok(file1.id)
    assert.equal(file1.checksum, checksum)
  })

  test('2. Same bytes, same name, same folder -> rejected with 409 DUPLICATE_CONTENT', async () => {
    const content = Buffer.from('identical-content-test-buffer-for-model-b')
    const checksum = crypto.createHash('sha256').update(content).digest('hex')
    const file1 = await prisma.file.findFirst({ where: { id: createdFileIds[0] } })
    assert.ok(file1)

    const res = await fetch(`${baseUrl}/uploads/check-dedup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        checksum,
        sizeBytes: content.length.toString(),
        fileName: 'contract.pdf',
        folderId: null,
      }),
    })

    assert.equal(res.status, 409)
    const json = (await res.json()) as any
    assert.equal(json.code, 'DUPLICATE_CONTENT')
    assert.equal(json.existingFileId, file1.id)
    assert.equal(json.existingFileName, 'contract.pdf')
    assert.equal(json.existingPath, '/contract.pdf')
  })

  test('3. Same bytes, different name, same folder -> accepted as legitimate duplicate', async () => {
    const content = Buffer.from('identical-content-test-buffer-for-model-b')
    const checksum = crypto.createHash('sha256').update(content).digest('hex')

    const res = await fetch(`${baseUrl}/uploads/check-dedup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        checksum,
        sizeBytes: content.length.toString(),
        fileName: 'contract_renamed.pdf',
        folderId: null,
      }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.canDeduplicate, false)
  })

  test('4. Same bytes, same name, different folder -> accepted as legitimate duplicate', async () => {
    const content = Buffer.from('identical-content-test-buffer-for-model-b')
    const checksum = crypto.createHash('sha256').update(content).digest('hex')

    const res = await fetch(`${baseUrl}/uploads/check-dedup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        checksum,
        sizeBytes: content.length.toString(),
        fileName: 'contract.pdf',
        folderId: testFolderId,
      }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.canDeduplicate, false)
  })

  test('5. Different bytes -> accepted', async () => {
    const modifiedContent = Buffer.from('different-content-test-buffer')
    const checksum = crypto.createHash('sha256').update(modifiedContent).digest('hex')

    const res = await fetch(`${baseUrl}/uploads/check-dedup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        checksum,
        sizeBytes: modifiedContent.length.toString(),
        fileName: 'contract.pdf',
        folderId: null,
      }),
    })

    assert.equal(res.status, 200)
    const json = (await res.json()) as any
    assert.equal(json.canDeduplicate, false)
  })
})
