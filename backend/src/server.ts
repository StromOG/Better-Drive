import { app } from './app.js'
import { env } from './config/env.js'
import { initSftpGatewayOnBoot, stopSftpServer } from './sftp/sftpGateway.js'
import { syncGoogleConfigFromEnv } from './modules/system/google-sync.js'

const server = app.listen(env.APP_PORT, async () => {
  console.log(`Backend running on http://localhost:${env.APP_PORT}`)
  await syncGoogleConfigFromEnv().catch((err) => console.warn('[*] Google env sync note:', err.message))
  await initSftpGatewayOnBoot()
})

async function gracefulShutdown(_signal: string) {
  await stopSftpServer()
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => void gracefulShutdown('SIGINT'))
