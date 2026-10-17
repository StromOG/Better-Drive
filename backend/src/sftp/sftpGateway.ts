import ssh2 from 'ssh2'
import { env } from '../config/env.js'
import { handleSftpAuth, type AuthenticatedSftpSession } from './auth.js'
import { writeSftpAuditLog } from './audit.js'
import { registerSftpHandlers } from './handlers/index.js'
import { loadOrCreateHostKey } from './hostKey.js'
import {
  canAcceptGlobalConnection,
  canAcceptUserSession,
  registerClientSession,
  unregisterClientSession,
} from './limits.js'

let serverInstance: ssh2.Server | null = null
let isRunning = false
const activeClientSockets = new Set<ssh2.Connection>()

export interface SftpStatusReport {
  enabled: boolean
  running: boolean
  host: string
  port: number
  hostKeyFingerprint: string | null
  activeConnections: number
}

export function getSftpStatus(): SftpStatusReport {
  let hostKeyFingerprint: string | null = null
  try {
    const keyData = loadOrCreateHostKey(env.SFTP_HOST_KEY_PATH)
    hostKeyFingerprint = keyData.fingerprint
  } catch {
    // If key not loaded yet or disabled
  }

  const currentPort = serverInstance ? ((serverInstance.address() as any)?.port ?? env.SFTP_PORT) : env.SFTP_PORT

  return {
    enabled: env.SFTP_ENABLED,
    running: isRunning,
    host: env.SFTP_HOST,
    port: currentPort,
    hostKeyFingerprint,
    activeConnections: activeClientSockets.size,
  }
}

export async function startSftpServer(overridePort?: number): Promise<boolean> {
  if (isRunning) return true
  const listenPort = overridePort ?? env.SFTP_PORT

  let hostKeyData
  try {
    hostKeyData = loadOrCreateHostKey(env.SFTP_HOST_KEY_PATH)
  } catch (err) {
    console.error(`[sftp] Failed to load or generate host key: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  try {
    const server = new ssh2.Server({
      hostKeys: [hostKeyData.privateKey],
    })

    server.on('connection', (client, info) => {
      const remoteIp = info.ip || '127.0.0.1'

      if (!canAcceptGlobalConnection()) {
        client.end()
        return
      }

      let currentSession: AuthenticatedSftpSession | null = null

      client.on('authentication', async (ctx) => {
        try {
          const authResult = await handleSftpAuth(ctx, remoteIp)
          if (authResult) {
            if (!canAcceptUserSession(authResult.userId)) {
              await writeSftpAuditLog({
                keyId: authResult.key.id,
                userId: authResult.userId,
                remoteIp,
                event: 'AUTH_FAIL',
                outcome: 'DENIED',
                path: 'too_many_user_sessions',
              })
              client.end()
              return
            }
            currentSession = authResult
            registerClientSession(authResult.userId, client)
            activeClientSockets.add(client)
          }
        } catch {
          ctx.reject(['publickey'])
        }
      })

      // Strict rejection of interactive shells, execs, PTYs, port forwardings
      client.on('session', (accept) => {
        const session = accept()

        session.on('pty', (_accept, reject) => reject())
        session.on('shell', (_accept, reject) => reject())
        session.on('exec', (_accept, reject) => reject())
        session.on('signal', (_accept, reject) => reject())
        session.on('x11', (_accept, reject) => reject())
        session.on('env', (_accept, reject) => reject())

        session.on('sftp', (acceptSftp, rejectSftp) => {
          if (!currentSession) {
            return rejectSftp()
          }
          const sftpStream = acceptSftp()
          registerSftpHandlers(sftpStream, currentSession)
        })
      })

      client.on('tcpip', (_accept, reject) => { reject?.() })
      client.on('request', (_accept, reject) => { reject?.() })
      ;(client as any).on('openssh.forward', (_accept: any, reject: any) => { reject?.() })

      client.on('close', async () => {
        activeClientSockets.delete(client)
        if (currentSession) {
          unregisterClientSession(currentSession.userId, client)
          await writeSftpAuditLog({
            keyId: currentSession.key.id,
            userId: currentSession.userId,
            remoteIp,
            event: 'DISCONNECT',
            outcome: 'OK',
          })
          currentSession = null
        }
      })

      client.on('error', () => {
        activeClientSockets.delete(client)
        if (currentSession) {
          unregisterClientSession(currentSession.userId, client)
          currentSession = null
        }
      })
    })

    await new Promise<void>((resolve, reject) => {
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[sftp] Port ${listenPort} is already in use. Gateway will not start, BetterDrive continues.`)
        } else {
          console.error(`[sftp] Failed to listen on ${env.SFTP_HOST}:${listenPort}: ${err.message}`)
        }
        reject(err)
      })

      server.listen(listenPort, env.SFTP_HOST, () => {
        serverInstance = server
        isRunning = true
        const actualPort = (server.address() as any)?.port ?? listenPort
        console.log(`[sftp] SFTP gateway listening on ${env.SFTP_HOST}:${actualPort}`)
        resolve()
      })
    })

    return true
  } catch {
    return false
  }
}

export async function stopSftpServer(): Promise<void> {
  if (!serverInstance || !isRunning) return

  return new Promise((resolve) => {
    isRunning = false
    const srv = serverInstance
    serverInstance = null

    // Drain active client connections gracefully
    for (const client of activeClientSockets) {
      try {
        client.end()
      } catch {
        // Ignore client end errors
      }
    }

    const timer = setTimeout(() => {
      for (const client of activeClientSockets) {
        try {
          if (typeof (client as any).destroy === 'function') {
            (client as any).destroy()
          } else {
            client.end()
          }
        } catch {
          // Ignore destroy errors
        }
      }
      activeClientSockets.clear()
    }, env.SFTP_SHUTDOWN_GRACE_MS)

    srv?.close(() => {
      clearTimeout(timer)
      activeClientSockets.clear()
      resolve()
    })
  })
}


export async function initSftpGatewayOnBoot(): Promise<void> {
  if (!env.SFTP_ENABLED) {
    return
  }
  await startSftpServer()
}
