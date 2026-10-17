import { Readable, PassThrough } from 'node:stream'
import ssh2 from 'ssh2'
import type { AuthenticatedSftpSession } from '../auth.js'
import { writeSftpAuditLog } from '../audit.js'
import { SftpError, SftpErrorCode } from '../errors.js'
import { checkUploadSizeLimit } from '../limits.js'
import {
  getUserAccountMappings,
  listVfsDirectory,
  mkdirVfsDirectory,
  openReadVfsFile,
  renameVfsTarget,
  rmdirVfsDirectory,
  statVfsTarget,
  unlinkVfsFile,
  writeVfsFile,
} from '../router.js'
import { parseAllowedRoots, resolveVfsPath, sanitizeSftpPath } from '../vfs.js'

const { STATUS_CODE, OPEN_MODE } = ssh2.utils.sftp

interface OpenHandle {
  id: string
  type: 'dir' | 'read' | 'write'
  path: string
  items?: Array<{ filename: string; longname: string; attrs: object }>
  cursor?: number
  readStream?: Readable
  writeStream?: PassThrough
  writePromise?: Promise<unknown>
  byteCount?: bigint
}

// ssh2 SFTP subsystem server stream emitting binary protocol request events
export function registerSftpHandlers(
  sftpStream: any,
  session: AuthenticatedSftpSession,
): void {
  const handles = new Map<string, OpenHandle>()
  let nextHandleId = 1

  function allocHandle(data: Omit<OpenHandle, 'id'>): Buffer {
    const handleStr = `h${nextHandleId++}`
    const handleBuf = Buffer.from(handleStr)
    handles.set(handleStr, { id: handleStr, ...data })
    return handleBuf
  }

  function getHandle(handleBuf: Buffer): OpenHandle | null {
    return handles.get(handleBuf.toString()) ?? null
  }

  // REALPATH: resolve client path to canonical path
  sftpStream.on('REALPATH', (reqId: number, rawPath: string) => {
    try {
      const p = rawPath ? sanitizeSftpPath(rawPath) : '/'
      sftpStream.name(reqId, [{ filename: p, longname: p, attrs: {} }])
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // STAT / LSTAT
  const handleStat = async (reqId: number, rawPath: string) => {
    try {
      if (!session.profile.allowRead) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      const accounts = await getUserAccountMappings(session.userId)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)
      const result = await statVfsTarget(target, session.userId)
      sftpStream.attrs(reqId, result.attrs)
    } catch (err) {
      if (err instanceof SftpError && err.code === SftpErrorCode.SFTP_ROOT_DENIED) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      return sftpStream.status(reqId, STATUS_CODE.NO_SUCH_FILE)
    }
  }

  sftpStream.on('STAT', handleStat)
  sftpStream.on('LSTAT', handleStat)

  // OPENDIR: list directory contents
  sftpStream.on('OPENDIR', async (reqId: number, rawPath: string) => {
    try {
      if (!session.profile.allowRead) {
        await writeSftpAuditLog({
          keyId: session.key.id,
          userId: session.userId,
          remoteIp: session.remoteIp,
          event: 'OPEN',
          path: rawPath,
          outcome: 'DENIED',
        })
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }

      const accounts = await getUserAccountMappings(session.userId)
      const allowedRoots = parseAllowedRoots(session.profile.allowedRoots)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)
      const items = await listVfsDirectory(target, session.userId, accounts, allowedRoots)

      const handleBuf = allocHandle({
        type: 'dir',
        path: target.normalizedPath,
        items,
        cursor: 0,
      })

      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'OPEN',
        path: target.normalizedPath,
        outcome: 'OK',
      })

      sftpStream.handle(reqId, handleBuf)
    } catch (err) {
      if (err instanceof SftpError && err.code === SftpErrorCode.SFTP_ROOT_DENIED) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      return sftpStream.status(reqId, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  // READDIR: iterate items
  sftpStream.on('READDIR', (reqId: number, handleBuf: Buffer) => {
    const handle = getHandle(handleBuf)
    if (!handle || handle.type !== 'dir' || !handle.items) {
      return sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }

    const start = handle.cursor ?? 0
    if (start >= handle.items.length) {
      return sftpStream.status(reqId, STATUS_CODE.EOF)
    }

    const chunk = handle.items.slice(start, start + 32)
    handle.cursor = start + chunk.length
    sftpStream.name(reqId, chunk)
  })

  // OPEN: file read or write
  sftpStream.on('OPEN', async (reqId: number, rawPath: string, flags: number, _attrs: Record<string, unknown>) => {
    try {
      const accounts = await getUserAccountMappings(session.userId)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)

      const isWrite = (flags & (OPEN_MODE.WRITE | OPEN_MODE.CREAT | OPEN_MODE.TRUNC)) !== 0

      if (isWrite) {
        if (!session.profile.allowWrite) {
          await writeSftpAuditLog({
            keyId: session.key.id,
            userId: session.userId,
            remoteIp: session.remoteIp,
            event: 'WRITE',
            path: target.normalizedPath,
            outcome: 'DENIED',
          })
          return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
        }

        const passThrough = new PassThrough()
        const writePromise = writeVfsFile(target, session.userId, passThrough)

        const handleBuf = allocHandle({
          type: 'write',
          path: target.normalizedPath,
          writeStream: passThrough,
          writePromise,
          byteCount: 0n,
        })

        return sftpStream.handle(reqId, handleBuf)
      }

      // Read file
      if (!session.profile.allowRead) {
        await writeSftpAuditLog({
          keyId: session.key.id,
          userId: session.userId,
          remoteIp: session.remoteIp,
          event: 'READ',
          path: target.normalizedPath,
          outcome: 'DENIED',
        })
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }

      const { stream, size } = await openReadVfsFile(target, session.userId)
      const handleBuf = allocHandle({
        type: 'read',
        path: target.normalizedPath,
        readStream: stream,
        byteCount: size,
      })

      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'OPEN',
        path: target.normalizedPath,
        outcome: 'OK',
      })

      return sftpStream.handle(reqId, handleBuf)
    } catch (err) {
      if (err instanceof SftpError && err.code === SftpErrorCode.SFTP_ROOT_DENIED) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      return sftpStream.status(reqId, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  // READ: chunk streaming
  sftpStream.on('READ', async (reqId: number, handleBuf: Buffer, offset: number, length: number) => {
    const handle = getHandle(handleBuf)
    if (!handle || handle.type !== 'read' || !handle.readStream) {
      return sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }

    try {
      const chunk = handle.readStream.read(length)
      if (chunk) {
        return sftpStream.data(reqId, chunk)
      }

      // If null, listen once for readable or end
      const onReadable = () => {
        cleanup()
        const data = handle.readStream?.read(length)
        if (data) {
          sftpStream.data(reqId, data)
        } else {
          sftpStream.status(reqId, STATUS_CODE.EOF)
        }
      }

      const onEnd = () => {
        cleanup()
        sftpStream.status(reqId, STATUS_CODE.EOF)
      }

      const cleanup = () => {
        handle.readStream?.removeListener('readable', onReadable)
        handle.readStream?.removeListener('end', onEnd)
      }

      handle.readStream.once('readable', onReadable)
      handle.readStream.once('end', onEnd)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // WRITE: chunk ingestion
  sftpStream.on('WRITE', async (reqId: number, handleBuf: Buffer, offset: number, data: Buffer) => {
    const handle = getHandle(handleBuf)
    if (!handle || handle.type !== 'write' || !handle.writeStream) {
      return sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }

    try {
      const newTotal = (handle.byteCount ?? 0n) + BigInt(data.length)
      if (!checkUploadSizeLimit(newTotal, session.profile.maxUploadBytes)) {
        handle.writeStream.destroy(new SftpError(SftpErrorCode.SFTP_QUOTA_EXCEEDED, 'File upload quota exceeded'))
        await writeSftpAuditLog({
          keyId: session.key.id,
          userId: session.userId,
          remoteIp: session.remoteIp,
          event: 'WRITE',
          path: handle.path,
          outcome: 'DENIED',
        })
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }

      handle.byteCount = newTotal
      handle.writeStream.write(data)
      sftpStream.status(reqId, STATUS_CODE.OK)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // CLOSE
  sftpStream.on('CLOSE', async (reqId: number, handleBuf: Buffer) => {
    const handle = getHandle(handleBuf)
    if (!handle) return sftpStream.status(reqId, STATUS_CODE.FAILURE)

    handles.delete(handle.id)

    if (handle.type === 'write' && handle.writeStream) {
      handle.writeStream.end()
      try {
        await handle.writePromise
        await writeSftpAuditLog({
          keyId: session.key.id,
          userId: session.userId,
          remoteIp: session.remoteIp,
          event: 'WRITE',
          path: handle.path,
          bytes: handle.byteCount,
          outcome: 'OK',
        })
      } catch {
        return sftpStream.status(reqId, STATUS_CODE.FAILURE)
      }
    }

    if (handle.type === 'read' && handle.readStream) {
      handle.readStream.destroy()
      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'READ',
        path: handle.path,
        bytes: handle.byteCount,
        outcome: 'OK',
      })
    }

    sftpStream.status(reqId, STATUS_CODE.OK)
  })

  // FSTAT
  sftpStream.on('FSTAT', (reqId: number, handleBuf: Buffer) => {
    const handle = getHandle(handleBuf)
    if (!handle) return sftpStream.status(reqId, STATUS_CODE.FAILURE)
    const isDir = handle.type === 'dir'
    const size = Number(handle.byteCount ?? 0n)
    sftpStream.attrs(reqId, {
      mode: (isDir ? 0o040755 : 0o100644),
      size,
      mtime: Math.floor(Date.now() / 1000),
      atime: Math.floor(Date.now() / 1000),
      uid: 0,
      gid: 0,
    })
  })

  // REMOVE (unlink)
  sftpStream.on('REMOVE', async (reqId: number, rawPath: string) => {
    try {
      if (!session.profile.allowDelete) {
        await writeSftpAuditLog({
          keyId: session.key.id,
          userId: session.userId,
          remoteIp: session.remoteIp,
          event: 'DELETE',
          path: rawPath,
          outcome: 'DENIED',
        })
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }

      const accounts = await getUserAccountMappings(session.userId)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)
      await unlinkVfsFile(target, session.userId)

      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'DELETE',
        path: target.normalizedPath,
        outcome: 'OK',
      })

      sftpStream.status(reqId, STATUS_CODE.OK)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // RMDIR
  sftpStream.on('RMDIR', async (reqId: number, rawPath: string) => {
    try {
      if (!session.profile.allowDelete) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      const accounts = await getUserAccountMappings(session.userId)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)
      await rmdirVfsDirectory(target, session.userId)
      sftpStream.status(reqId, STATUS_CODE.OK)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // MKDIR
  sftpStream.on('MKDIR', async (reqId: number, rawPath: string) => {
    try {
      if (!session.profile.allowWrite) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      const accounts = await getUserAccountMappings(session.userId)
      const target = resolveVfsPath(rawPath, session.profile.allowedRoots, accounts)
      await mkdirVfsDirectory(target, session.userId)

      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'MKDIR',
        path: target.normalizedPath,
        outcome: 'OK',
      })

      sftpStream.status(reqId, STATUS_CODE.OK)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })

  // RENAME
  sftpStream.on('RENAME', async (reqId: number, oldPath: string, newPath: string) => {
    try {
      if (!session.profile.allowWrite) {
        return sftpStream.status(reqId, STATUS_CODE.PERMISSION_DENIED)
      }
      const accounts = await getUserAccountMappings(session.userId)
      const oldTarget = resolveVfsPath(oldPath, session.profile.allowedRoots, accounts)
      const newTarget = resolveVfsPath(newPath, session.profile.allowedRoots, accounts)
      await renameVfsTarget(oldTarget, newTarget, session.userId)

      await writeSftpAuditLog({
        keyId: session.key.id,
        userId: session.userId,
        remoteIp: session.remoteIp,
        event: 'RENAME',
        path: `${oldTarget.normalizedPath} -> ${newTarget.normalizedPath}`,
        outcome: 'OK',
      })

      sftpStream.status(reqId, STATUS_CODE.OK)
    } catch {
      sftpStream.status(reqId, STATUS_CODE.FAILURE)
    }
  })
}
