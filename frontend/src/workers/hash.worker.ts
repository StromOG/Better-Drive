/**
 * Dedicated Web Worker for off-main-thread SHA-256 calculation.
 * Prevents UI freezes when hashing files up to CLIENT_HASH_MAX_BYTES.
 */

self.onmessage = async (event: MessageEvent<{ file: File; id: string }>) => {
  const { file, id } = event.data
  try {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const checksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    self.postMessage({ id, checksum, error: null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Hash calculation failed'
    self.postMessage({ id, checksum: null, error: message })
  }
}
