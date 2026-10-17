export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'document' | 'office'

const officeMimeTypes = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

const googleDocumentMimeTypes = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
])

const codeMimeTypes = new Set([
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'text/javascript',
  'text/typescript',
  'text/html',
  'text/css',
  'text/markdown',
  'text/plain',
  'text/x-python',
  'text/x-sh',
  'text/x-shellscript',
  'text/yaml',
  'application/x-yaml',
])

export function getPreviewKind(mimeType: string | undefined): PreviewKind | null {
  if (!mimeType) return null
  if (mimeType.startsWith('image/') || mimeType === 'application/vnd.google-apps.drawing') return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (codeMimeTypes.has(mimeType) || mimeType.startsWith('text/')) return 'text'
  if (mimeType === 'application/pdf' || googleDocumentMimeTypes.has(mimeType)) return 'document'
  if (officeMimeTypes.has(mimeType)) return 'office'
  return null
}

export function officeViewerUrl(fileUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
}

export function isSpreadsheetMimeType(mimeType: string | undefined) {
  return mimeType === 'application/vnd.google-apps.spreadsheet' || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
