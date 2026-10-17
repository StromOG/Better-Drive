import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ssh2 from 'ssh2'
import { SftpError, SftpErrorCode } from './errors.js'

export interface HostKeyData {
  privateKey: Buffer
  publicKeyOpenSsh: string
  fingerprint: string
}

let cachedHostKey: HostKeyData | null = null

export function computeSha256Fingerprint(keyBufferOrBase64: Buffer | string): string {
  const buf = typeof keyBufferOrBase64 === 'string'
    ? Buffer.from(keyBufferOrBase64.trim().split(/\s+/)[1] || keyBufferOrBase64, 'base64')
    : keyBufferOrBase64
  return crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '')
}

export function loadOrCreateHostKey(keyPath: string): HostKeyData {
  if (cachedHostKey) return cachedHostKey

  const resolvedPath = path.resolve(keyPath)
  const dir = path.dirname(resolvedPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (fs.existsSync(resolvedPath)) {
    // POSIX permission check
    if (process.platform !== 'win32') {
      const stat = fs.statSync(resolvedPath)
      const mode = stat.mode & 0o777
      if ((mode & 0o077) !== 0) {
        throw new SftpError(
          SftpErrorCode.SFTP_HOST_KEY_ERROR,
          `Host key ${resolvedPath} has overly permissive permissions: 0${mode.toString(8)}. Must be 0600.`,
        )
      }
    }

    const privKeyRaw = fs.readFileSync(resolvedPath)
    const parsed = ssh2.utils.parseKey(privKeyRaw)
    if (parsed instanceof Error || !parsed) {
      throw new SftpError(SftpErrorCode.SFTP_HOST_KEY_ERROR, `Failed to parse host key at ${resolvedPath}`)
    }

    const pubPath = `${resolvedPath}.pub`
    const pubKeyOpenSsh = fs.existsSync(pubPath)
      ? fs.readFileSync(pubPath, 'utf8').trim()
      : (parsed.getPublicSSH ? `ssh-ed25519 ${parsed.getPublicSSH().toString('base64')} betterdrive-host` : '')

    const fingerprint = pubKeyOpenSsh
      ? computeSha256Fingerprint(pubKeyOpenSsh)
      : computeSha256Fingerprint(parsed.getPublicSSH ? parsed.getPublicSSH() : Buffer.alloc(0))

    cachedHostKey = {
      privateKey: privKeyRaw,
      publicKeyOpenSsh: pubKeyOpenSsh,
      fingerprint,
    }
    return cachedHostKey
  }

  // Generate new Ed25519 keypair
  const keyPair = ssh2.utils.generateKeyPairSync('ed25519')
  const privateKeyPem = keyPair.private
  const publicKeyStr = `${keyPair.public} betterdrive-host`

  fs.writeFileSync(resolvedPath, privateKeyPem, { mode: 0o600 })
  fs.writeFileSync(`${resolvedPath}.pub`, publicKeyStr, { mode: 0o644 })

  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(resolvedPath, 0o600)
    } catch {
      // Ignore if filesystem restricts chmod
    }
  }

  const fingerprint = computeSha256Fingerprint(keyPair.public)
  cachedHostKey = {
    privateKey: Buffer.from(privateKeyPem),
    publicKeyOpenSsh: publicKeyStr,
    fingerprint,
  }
  return cachedHostKey
}

export function clearHostKeyCache(): void {
  cachedHostKey = null
}
