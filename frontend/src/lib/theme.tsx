import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from 'react'
import { getStoredUser } from './auth'
import { apiFetch } from './api'

export interface AppThemeConfig {
  id: string
  name: string
  mode: 'light' | 'dark'
  tagline: string
  description: string
  palette: {
    bg: string
    card: string
    accent: string
    secondary: string
    previewColors: string[]
  }
}

export const APP_THEMES: AppThemeConfig[] = [
  // 4 Curated Light Themes (Arctic is default and primary)
  {
    id: 'arctic-pure',
    name: 'Arctic',
    mode: 'light',
    tagline: 'Glacier & Cobalt',
    description: 'Crisp glacier blue canvas with frosted cards, steel borders, and cobalt blue.',
    palette: {
      bg: '#e8f2ff',
      card: '#f4f8fe',
      accent: '#2563eb',
      secondary: '#0284c7',
      previewColors: ['#e8f2ff', '#f4f8fe', '#93c5fd', '#2563eb', '#1d4ed8'],
    },
  },
  {
    id: 'cotton-pastel',
    name: 'Pastel',
    mode: 'light',
    tagline: 'Cream & Rose',
    description: 'Warm cream canvas with soft peach glow, linen cards, and rose accents.',
    palette: {
      bg: '#fdf8f4',
      card: '#ffffff',
      accent: '#ec4899',
      secondary: '#f59e0b',
      previewColors: ['#fdf8f4', '#ffffff', '#f0dfd5', '#ec4899', '#db2777'],
    },
  },
  {
    id: 'rose-quartz',
    name: 'Rose',
    mode: 'light',
    tagline: 'Blush & Crimson',
    description: 'Soft pink strawberry canvas with rose-tinted cards and crimson accents.',
    palette: {
      bg: '#fdf2f4',
      card: '#fff5f7',
      accent: '#e11d48',
      secondary: '#fb7185',
      previewColors: ['#fdf2f4', '#fff5f7', '#f472b6', '#e11d48', '#be123c'],
    },
  },
  {
    id: 'emerald-mist',
    name: 'Mint',
    mode: 'light',
    tagline: 'Sage & Emerald',
    description: 'Fresh spring mint canvas with pale matcha cards and emerald green accents.',
    palette: {
      bg: '#e8f7ee',
      card: '#f2faf5',
      accent: '#059669',
      secondary: '#10b981',
      previewColors: ['#e8f7ee', '#f2faf5', '#86efac', '#059669', '#047857'],
    },
  },

  // 4 Curated Dark Themes
  {
    id: 'midnight-nebula',
    name: 'Midnight',
    mode: 'dark',
    tagline: 'Navy & Violet',
    description: 'Deep navy oceanic canvas with sapphire cards, indigo borders, and violet accents.',
    palette: {
      bg: '#071126',
      card: '#111d38',
      accent: '#818cf8',
      secondary: '#6366f1',
      previewColors: ['#071126', '#111d38', '#2d4a7e', '#818cf8', '#6366f1'],
    },
  },
  {
    id: 'cyber-obsidian',
    name: 'OLED Black',
    mode: 'dark',
    tagline: 'True Black & Cyan',
    description: 'Pitch black background with matte carbon cards and neon cyan accents.',
    palette: {
      bg: '#000000',
      card: '#0c0c0e',
      accent: '#00f5ff',
      secondary: '#06b6d4',
      previewColors: ['#000000', '#0c0c0e', '#27272e', '#00f5ff', '#06b6d4'],
    },
  },
  {
    id: 'sunset-velvet',
    name: 'Plum',
    mode: 'dark',
    tagline: 'Velvet & Coral',
    description: 'Royal aubergine wine canvas with deep plum cards and sunset coral accents.',
    palette: {
      bg: '#220d30',
      card: '#331349',
      accent: '#f43f5e',
      secondary: '#e11d48',
      previewColors: ['#220d30', '#331349', '#7e22ce', '#f43f5e', '#e11d48'],
    },
  },
  {
    id: 'deep-forest',
    name: 'Forest',
    mode: 'dark',
    tagline: 'Pine & Emerald',
    description: 'Twilight pine evergreen canvas with dark spruce cards and bright mint accents.',
    palette: {
      bg: '#051d14',
      card: '#0c3222',
      accent: '#10b981',
      secondary: '#059669',
      previewColors: ['#051d14', '#0c3222', '#15803d', '#10b981', '#059669'],
    },
  },
]

export function applyThemeToDocument(themeId: string) {
  if (typeof document === 'undefined') return
  const config = APP_THEMES.find((t) => t.id === themeId) || APP_THEMES[0]
  document.documentElement.setAttribute('data-theme', config.id)
  if (config.mode === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  }
}

export function getInitialTheme(userId?: string): string {
  if (typeof window === 'undefined') return 'arctic-pure'
  if (userId) {
    const userTheme = localStorage.getItem(`betterdrive:theme:${userId}`)
    if (userTheme && APP_THEMES.some((t) => t.id === userTheme)) return userTheme
  }
  const general = localStorage.getItem('betterdrive:theme')
  if (general && APP_THEMES.some((t) => t.id === general)) return general
  return 'arctic-pure'
}

interface ThemeContextValue {
  currentTheme: string
  themeConfig: AppThemeConfig
  isDarkMode: boolean
  setTheme: (themeId: string) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const initial = getInitialTheme(getStoredUser()?.id)
    applyThemeToDocument(initial)
    return initial
  })

  const userChangedThemeRef = useRef(false)

  // Sync with user account changes (login/logout/switch user)
  useEffect(() => {
    let active = true
    const currentUserId = getStoredUser()?.id

    if (currentUserId) {
      const accountTheme = getInitialTheme(currentUserId)
      if (!userChangedThemeRef.current) {
        setCurrentTheme(accountTheme)
        applyThemeToDocument(accountTheme)
      }

      // Also fetch any backend-saved preference for this account
      apiFetch<{ settings?: { dashboardTheme?: string } }>('/mascot/settings')
        .then((res) => {
          if (!active || userChangedThemeRef.current) return
          const remote = res?.settings?.dashboardTheme
          if (remote && APP_THEMES.some((t) => t.id === remote)) {
            setCurrentTheme(remote)
            applyThemeToDocument(remote)
            localStorage.setItem(`betterdrive:theme:${currentUserId}`, remote)
            localStorage.setItem('betterdrive:theme', remote)
          }
        })
        .catch(() => {})
    }

    function handleUserUpdated(e: Event) {
      const customEvent = e as CustomEvent<any>
      const newUserId = customEvent?.detail?.id ?? getStoredUser()?.id
      if (newUserId && !userChangedThemeRef.current) {
        const userTheme = getInitialTheme(newUserId)
        setCurrentTheme(userTheme)
        applyThemeToDocument(userTheme)
      }
    }

    window.addEventListener('betterdrive:user-updated', handleUserUpdated)
    return () => {
      active = false
      window.removeEventListener('betterdrive:user-updated', handleUserUpdated)
    }
  }, [])

  const setTheme = useCallback((themeId: string) => {
    const config = APP_THEMES.find((t) => t.id === themeId)
    if (!config) return
    userChangedThemeRef.current = true
    setCurrentTheme(themeId)
    applyThemeToDocument(themeId)
    localStorage.setItem('betterdrive:theme', themeId)
    const activeUserId = getStoredUser()?.id
    if (activeUserId) {
      localStorage.setItem(`betterdrive:theme:${activeUserId}`, themeId)
      // Persist to backend database for this user
      apiFetch('/mascot/settings', {
        method: 'PUT',
        body: JSON.stringify({ dashboardTheme: themeId }),
      }).catch(() => {})
    }
  }, [])

  const toggleMode = useCallback(() => {
    const active = APP_THEMES.find((t) => t.id === currentTheme) || APP_THEMES[0]
    if (active.mode === 'light') {
      // Switch to default dark
      setTheme('midnight-nebula')
    } else {
      // Switch to default light (Arctic)
      setTheme('arctic-pure')
    }
  }, [currentTheme, setTheme])

  const themeConfig = APP_THEMES.find((t) => t.id === currentTheme) || APP_THEMES[0]

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        themeConfig,
        isDarkMode: themeConfig.mode === 'dark',
        setTheme,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
