import { createContext, useContext, useLayoutEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export interface ThemeColors {
  primaryText: string
  dimText: string
  bodyText: string
  trackBg: string
}

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  toggle: () => void
  colors: ThemeColors
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function deriveColors(isDark: boolean): ThemeColors {
  return {
    primaryText: isDark ? '#dde6ff' : '#0d1533',
    dimText: isDark ? 'rgba(195,210,255,0.72)' : 'rgba(13,21,51,0.55)',
    bodyText: isDark ? 'rgba(195,210,255,0.9)' : 'rgba(13,21,51,0.78)',
    trackBg: isDark ? 'rgba(150,175,255,0.12)' : 'rgba(13,21,51,0.1)',
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))
  const isDark = theme === 'dark'

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggle, colors: deriveColors(isDark) }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
