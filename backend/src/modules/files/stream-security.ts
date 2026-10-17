import type { Response } from 'express'

/**
 * Response hardening for streamed user content.
 *
 * Uploaded files are served from the API origin. Without these headers an
 * uploaded .html or .svg shared through a public link becomes a script
 * running on the API's own origin — stored XSS that any registered user can
 * trigger. Two defences, because either alone has gaps:
 *
 *   1. Only a safelist of types is ever served `inline`. Everything else is
 *      forced to `attachment`, which browsers download rather than render.
 *   2. Every streamed response carries `nosniff` plus a CSP that blocks all
 *      subresources and sandboxes the document, so even a type that slips
 *      through cannot execute script or phone home.
 */

/** Types a browser renders safely and that users actually want to preview. */
const INLINE_SAFE = [
  'application/pdf',
  'audio/',
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'video/',
]

/**
 * SVG and anything HTML- or XML-shaped is excluded on purpose: SVG carries
 * script, and `text/html` is the whole problem. They download instead.
 */
export function isInlineSafe(mimeType: string) {
  const type = mimeType.toLowerCase().split(';')[0].trim()
  return INLINE_SAFE.some((safe) => (safe.endsWith('/') ? type.startsWith(safe) : type === safe))
}

export function resolveDisposition(
  requested: 'inline' | 'attachment' | undefined,
  mimeType: string,
): 'inline' | 'attachment' {
  if (requested !== 'inline') return 'attachment'
  return isInlineSafe(mimeType) ? 'inline' : 'attachment'
}

/**
 * Builds a Content-Disposition value. Control characters are stripped rather
 * than escaped: a filename containing CR or LF would otherwise attempt header
 * injection, and Node would reject the whole response.
 */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string) {
  const cleaned = fileName.replace(/[\u0000-\u001f\u007f"\\]/g, '').trim() || 'download'
  const ascii = cleaned.replace(/[^\x20-\x7e]/g, '_')
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`
}

export function applyStreamSecurityHeaders(res: Response) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox")
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  // User content must never be cached by a shared proxy under a share token.
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
}
