import assert from 'node:assert/strict'
import http from 'node:http'
import { test, describe, before, after } from 'node:test'
import { app } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { signAccessToken } from '../../src/utils/jwt.js'

describe('Notification Preferences (Part 1.5.3)', () => {
  let server: http.Server
  let baseUrl: string
  let testUser: any
  let userToken: string

  before(async () => {
    server = http.createServer(app)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    const stamp = Date.now()
    testUser = await prisma.user.create({
      data: {
        email: `notif-test-${stamp}@betterdrive.internal`,
        name: 'Notif Test User',
        passwordHash: 'dummy',
        role: 'member',
        status: 'active',
      },
    })
    const session = await prisma.userSession.create({
      data: {
        userId: testUser.id,
        refreshTokenHash: `refresh-notif-${stamp}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    userToken = signAccessToken({ sub: testUser.id, sid: session.id })
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('1. Default state for new user: all 5 in-app events are enabled: true', async () => {
    const res = await fetch(`${baseUrl}/me/notifications/preferences`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data.preferences))
    assert.equal(data.preferences.length, 5)

    const expectedEvents = [
      'upload.complete',
      'upload.failed',
      'storage.warning',
      'member.invited',
      'share.accessed',
    ]
    for (const eventType of expectedEvents) {
      const match = data.preferences.find((p: any) => p.eventType === eventType)
      assert.ok(match, `Expected preference for ${eventType}`)
      assert.equal(match.enabled, true)
    }
  })

  test('2. Toggle preference persists', async () => {
    const updateRes = await fetch(`${baseUrl}/me/notifications/preferences`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preferences: [
          { eventType: 'upload.complete', enabled: false },
          { eventType: 'storage.warning', enabled: false },
        ],
      }),
    })
    assert.equal(updateRes.status, 200)

    // Re-fetch to ensure persistence
    const getRes = await fetch(`${baseUrl}/me/notifications/preferences`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    assert.equal(getRes.status, 200)
    const data = await getRes.json()

    const complete = data.preferences.find((p: any) => p.eventType === 'upload.complete')
    assert.equal(complete?.enabled, false)

    const warning = data.preferences.find((p: any) => p.eventType === 'storage.warning')
    assert.equal(warning?.enabled, false)

    const failed = data.preferences.find((p: any) => p.eventType === 'upload.failed')
    assert.equal(failed?.enabled, true)
  })
})
