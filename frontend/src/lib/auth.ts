export type AuthUser = {
  id: string
  name: string
  email: string
  role?: 'owner' | 'admin' | 'member' | string
  status?: string
  avatarUrl?: string
}

const ACCESS_TOKEN_KEY = 'betterdrive.accessToken'
const REFRESH_TOKEN_KEY = 'betterdrive.refreshToken'
const USER_KEY = 'betterdrive.user'
const AVATAR_PREFIX = 'betterdrive:avatar:'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    const user = JSON.parse(raw) as AuthUser
    if (user) {
      const emailKey = user.email ? user.email.trim().toLowerCase() : ''
      const savedAvatar =
        user.avatarUrl ??
        (emailKey ? localStorage.getItem(`${AVATAR_PREFIX}${emailKey}`) : null) ??
        (user.id ? localStorage.getItem(`${AVATAR_PREFIX}${user.id}`) : null) ??
        localStorage.getItem(`${AVATAR_PREFIX}latest`)
      if (savedAvatar) {
        user.avatarUrl = savedAvatar
      }
    }
    return user
  } catch {
    return null
  }
}

export function setAuthSession(accessToken: string, refreshToken: string, user: AuthUser) {
  if (user) {
    const emailKey = user.email ? user.email.trim().toLowerCase() : ''
    const savedAvatar =
      user.avatarUrl ??
      (emailKey ? localStorage.getItem(`${AVATAR_PREFIX}${emailKey}`) : null) ??
      (user.id ? localStorage.getItem(`${AVATAR_PREFIX}${user.id}`) : null) ??
      localStorage.getItem(`${AVATAR_PREFIX}latest`)
    if (savedAvatar) {
      user.avatarUrl = savedAvatar
      if (emailKey) localStorage.setItem(`${AVATAR_PREFIX}${emailKey}`, savedAvatar)
      if (user.id) localStorage.setItem(`${AVATAR_PREFIX}${user.id}`, savedAvatar)
      localStorage.setItem(`${AVATAR_PREFIX}latest`, savedAvatar)
    }
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('betterdrive:user-updated', { detail: user }))
}

export function updateStoredUser(user: AuthUser) {
  if (user) {
    const emailKey = user.email ? user.email.trim().toLowerCase() : ''
    if (user.avatarUrl) {
      if (emailKey) localStorage.setItem(`${AVATAR_PREFIX}${emailKey}`, user.avatarUrl)
      if (user.id) localStorage.setItem(`${AVATAR_PREFIX}${user.id}`, user.avatarUrl)
      localStorage.setItem(`${AVATAR_PREFIX}latest`, user.avatarUrl)
    }
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('betterdrive:user-updated', { detail: user }))
}

export function setAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearAuthSession(wipeUser = true) {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  if (wipeUser) {
    localStorage.removeItem(USER_KEY)
  }
}
