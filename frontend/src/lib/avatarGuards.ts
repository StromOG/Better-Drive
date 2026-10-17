export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
]

export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024 // 2.0 MB
export const MIN_AVATAR_DIMENSION = 64 // 64x64 px
export const MAX_AVATAR_DIMENSION = 4096 // 4096x4096 px

export interface AvatarValidationMeta {
  name: string
  sizeBytes: number
  sizeFormatted: string
  type: string
  width?: number
  height?: number
  aspectRatio?: string
  isSquare?: boolean
}

export interface AvatarValidationResult {
  valid: boolean
  error?: string
  warning?: string
  meta: AvatarValidationMeta
  dataUrl?: string
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Validates an uploaded avatar image file against size, MIME type,
 * file extension, and pixel dimensions.
 */
export async function validateAvatarFile(file: File): Promise<AvatarValidationResult> {
  const meta: AvatarValidationMeta = {
    name: file.name,
    sizeBytes: file.size,
    sizeFormatted: formatFileSize(file.size),
    type: file.type || 'unknown'
  }

  // 1. Guard: File size limit (2 MB)
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${meta.sizeFormatted}). Maximum allowed avatar size is 2.0 MB.`,
      meta
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes).',
      meta
    }
  }

  // 2. Guard: MIME type and extension
  const extension = '.' + (file.name.split('.').pop() || '').toLowerCase()
  const isTypeAllowed = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(extension)

  if (!isTypeAllowed && !isExtAllowed) {
    return {
      valid: false,
      error: `Unsupported format ("${file.type || extension}"). Allowed formats: PNG, JPG, WebP, SVG, GIF.`,
      meta
    }
  }

  // 3. Read file contents into Data URL
  let dataUrl: string
  try {
    dataUrl = await readFileAsDataUrl(file)
  } catch {
    return {
      valid: false,
      error: 'Could not read image file. Please try another image.',
      meta
    }
  }

  // 4. SVG Guard & Handling
  if (file.type === 'image/svg+xml' || extension === '.svg') {
    // Sanitize check for <script> tags
    try {
      const text = await file.text()
      if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(text)) {
        return {
          valid: false,
          error: 'Security guard: SVG contains executable script elements and cannot be accepted.',
          meta
        }
      }
      meta.isSquare = true
      meta.aspectRatio = 'Vector SVG (Scalable)'
      return {
        valid: true,
        meta,
        dataUrl
      }
    } catch {
      return {
        valid: false,
        error: 'Failed to parse SVG content.',
        meta
      }
    }
  }

  // 5. Dimension & Aspect Ratio Guards for raster images
  try {
    const dimensions = await getImageDimensions(dataUrl)
    meta.width = dimensions.width
    meta.height = dimensions.height

    if (dimensions.width < MIN_AVATAR_DIMENSION || dimensions.height < MIN_AVATAR_DIMENSION) {
      return {
        valid: false,
        error: `Resolution is too small (${dimensions.width}×${dimensions.height}px). Minimum required is ${MIN_AVATAR_DIMENSION}×${MIN_AVATAR_DIMENSION}px.`,
        meta
      }
    }

    if (dimensions.width > MAX_AVATAR_DIMENSION || dimensions.height > MAX_AVATAR_DIMENSION) {
      return {
        valid: false,
        error: `Resolution is too large (${dimensions.width}×${dimensions.height}px). Maximum allowed is ${MAX_AVATAR_DIMENSION}×${MAX_AVATAR_DIMENSION}px.`,
        meta
      }
    }

    const ratio = dimensions.width / dimensions.height
    meta.aspectRatio = `${dimensions.width} × ${dimensions.height} (${ratio.toFixed(2)}:1)`
    const isSquare = ratio >= 0.85 && ratio <= 1.15
    meta.isSquare = isSquare

    let warning: string | undefined
    if (!isSquare) {
      warning = `Image is not 1:1 square (${dimensions.width}×${dimensions.height}px). It will be center-cropped to fit the avatar circle.`
    }

    return {
      valid: true,
      warning,
      meta,
      dataUrl
    }
  } catch {
    return {
      valid: false,
      error: 'Corrupt or unreadable image file.',
      meta
    }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image for dimension check'))
    img.src = dataUrl
  })
}

/**
 * Crops and resizes any source image into a high-quality 256x256 square canvas,
 * returning a lightweight, optimized data URL.
 */
export function createSquareAvatarDataUrl(dataUrl: string, targetSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = targetSize
      canvas.height = targetSize
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      const sw = img.naturalWidth
      const sh = img.naturalHeight
      const size = Math.min(sw, sh)
      const sx = (sw - size) / 2
      const sy = (sh - size) / 2

      ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize)
      // Export as webp or png fallback
      const output = canvas.toDataURL('image/webp', 0.92)
      resolve(output)
    }
    img.onerror = () => reject(new Error('Failed to process image canvas'))
    img.src = dataUrl
  })
}
