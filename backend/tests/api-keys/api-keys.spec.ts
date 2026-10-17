import assert from 'node:assert/strict'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('API Keys Lifecycle & Authentication (Part 1.5.2)', () => {
  let server: http.Server
  let baseUrl: string
  let testUser: any
  let userToken: string
  let createdKeyId: string
  let createdPlaintext: string

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    const stamp = Date.now()
    testUser = await prisma.user.create({
      data: {
        email: `key-test-${stamp}@betterdrive.internal`,
        name: 'Key Test User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const session = await prisma.userSession.create({
      data: {
        userId: testUser.id,
        refreshTokenHash: `refresh-key-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    userToken = signAccessToken({ sub: testUser.id, sid: session.id })
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. Create key: returns plaintext once', async () => {
    const res = await fetch(`${baseUrl}/me/api-keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: 'CI Deploy Key' }),
    })
    assert.equal(res.status, 201)
    const data = await res.json()
    assert.ok(data.apiKey.id)
    assert.equal(data.apiKey.label, 'CI Deploy Key')
    assert.ok(data.plaintext)
    assert.ok(data.plaintext.startsWith('bd_live_'))

    createdKeyId = data.apiKey.id
    createdPlaintext = data.plaintext

    // Verify database does NOT store plaintext, only SHA-256 hash
    const dbKey = await prisma.apiKey.findUnique({ where: { id: createdKeyId } })
    assert.ok(dbKey?.keyHash)
    assert.notEqual(dbKey?.keyHash, createdPlaintext)
  })

  test('2. Use key in Authorization header: authenticates', async () => {
    const res = await fetch(`${baseUrl}/files`, {
      headers: {
        Authorization: `Bearer ${createdPlaintext}`,
      },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.files))
  })

  test('3. Revoke key: subsequent use fails', async () => {
    const revokeRes = await fetch(`${baseUrl}/me/api-keys/${createdKeyId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    })
    assert.equal(revokeRes.status, 200)

    const useRes = await fetch(`${baseUrl}/files`, {
      headers: {
        Authorization: `Bearer ${createdPlaintext}`,
      },
    })
    assert.equal(useRes.status, 401)
    const data = await useRes.json()
    assert.equal(data.code, 'API_KEY_REVOKED')
  })

  test('4. Rate limit on key auth: 429 after limit', async () => {
    // Create a new key for rate limit testing
    const createRes = await fetch(`${baseUrl}/me/api-keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label: 'Rate Limit Key' }),
    })
    const { plaintext } = await createRes.json()

    // Send requests up to limit
    const limit = env.API_KEY_RATE_LIMIT_MAX
    let rateLimited = false

    // Fast burst
    for (let i = 0; i < limit + 5; i++) {
      const res = await fetch(`${baseUrl}/files`, {
        headers: { Authorization: `Bearer ${plaintext}` },
      })
      if (res.status === 429) {
        rateLimited = true
        const err = await res.json()
        assert.equal(err.code, 'RATE_LIMIT_EXCEEDED')
        break
      }
    }
    assert.ok(rateLimited, 'Expected to hit 429 after limit')
  })
})
