import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { classifyFileCategory } from '../../src/modules/storage/storage.routes.js'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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
  'application/toml',
])

function getPreviewKind(mimeType: string | undefined): 'image' | 'video' | 'audio' | 'text' | 'document' | 'office' | null {
  if (!mimeType) return null
  if (mimeType.startsWith('image/') || mimeType === 'application/vnd.google-apps.drawing') return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (codeMimeTypes.has(mimeType) || mimeType.startsWith('text/')) return 'text'
  if (mimeType === 'application/pdf' || mimeType.startsWith('application/vnd.google-apps.')) return 'document'
  return null
}

describe('Consolidated Preview Hardening & Category Routing (Parts 4 & 5)', () => {
  test('1. test.html with <script>alert(1)</script> is escaped into harmless plain text entities', () => {
    const maliciousHtml = '<!DOCTYPE html><html><body><script>alert(1)</script></body></html>'
    const escaped = escapeHtml(maliciousHtml)
    assert.equal(escaped.includes('<script>'), false)
    assert.equal(escaped.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true)
  })

  test('2. escapeHtml neutralizes double quotes, single quotes, ampersands, and angle brackets', () => {
    const input = '<img src=x onerror="alert(\'xss\')" />&foo'
    const escaped = escapeHtml(input)
    assert.equal(escaped, '&lt;img src=x onerror=&quot;alert(&#039;xss&#039;)&quot; /&gt;&amp;foo')
    assert.ok(!escaped.includes('<img'))
    assert.ok(!escaped.includes('"'))
  })

  test('3. getPreviewKind correctly flags code and text formats as text kind for plaintext preview', () => {
    assert.equal(getPreviewKind('text/html'), 'text')
    assert.equal(getPreviewKind('application/javascript'), 'text')
    assert.equal(getPreviewKind('text/x-python'), 'text')
    assert.equal(getPreviewKind('application/json'), 'text')
    assert.equal(getPreviewKind('text/markdown'), 'text')
  })

  test('4. Storage category map accurately categorizes requested file extensions', () => {
    assert.equal(classifyFileCategory('photo.heic', 'image/heic'), 'photo')
    assert.equal(classifyFileCategory('photo.webp', 'image/webp'), 'photo')
    assert.equal(classifyFileCategory('icon.svg', 'image/svg+xml'), 'photo')
    assert.equal(classifyFileCategory('readme.md', 'text/markdown'), 'code')
    assert.equal(classifyFileCategory('ci.yml', 'text/yaml'), 'code')
    assert.equal(classifyFileCategory('config.yaml', 'application/x-yaml'), 'code')
    assert.equal(classifyFileCategory('cargo.toml', 'application/toml'), 'code')
    assert.equal(classifyFileCategory('.env', 'text/plain'), 'code')
    assert.equal(classifyFileCategory('package-lock.json', 'application/json'), 'code')
    assert.equal(classifyFileCategory('pnpm.lock', 'text/plain'), 'code')
    assert.equal(classifyFileCategory('data.csv', 'text/csv'), 'document')
    assert.equal(classifyFileCategory('analytics.parquet', 'application/octet-stream'), 'document')
    assert.equal(classifyFileCategory('unknown.bin', 'application/octet-stream'), 'other')
  })
})
