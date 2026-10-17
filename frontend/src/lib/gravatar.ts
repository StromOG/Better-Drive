// Generates a fun, unique avatar URL for a user based on their email.
// Uses DiceBear "bottts" style (cute robots) as the default when no Gravatar is set.
// Falls back to a random avatar when no email is provided.
const gravatarCache = new Map<string, string>()

export async function getGravatarUrl(email: string | undefined, size: number): Promise<string> {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) {
    return `https://api.dicebear.com/8.x/bottts/svg?seed=user&size=${size}&backgroundColor=b6e3f4,c0aede,d1f4cc,ffdfbf,ffd5dc`
  }

  const cacheKey = `${normalized}:${size}`
  if (gravatarCache.has(cacheKey)) {
    return gravatarCache.get(cacheKey)!
  }

  // Hash the email for Gravatar lookup + as DiceBear seed
  let hash: string
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
      hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    } catch {
      hash = simpleHash(normalized)
    }
  } else {
    hash = simpleHash(normalized)
  }

  // Try Gravatar with a fast 1s timeout; fallback to DiceBear bottts
  if (hash.length === 64) {
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)
      const res = await fetch(gravatarUrl, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        gravatarCache.set(cacheKey, gravatarUrl)
        return gravatarUrl
      }
    } catch {
      // Fall through on error or timeout
    }
  }

  const fallbackUrl = `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(hash)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1f4cc,ffdfbf,ffd5dc`
  gravatarCache.set(cacheKey, fallbackUrl)
  return fallbackUrl
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
