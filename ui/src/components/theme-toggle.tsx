import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, toggleVariant, type ThemeId } from '@/lib/theme'

// Dark/light switch for the two Mercury modes.
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>('mercury')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  const flip = () => {
    const next = toggleVariant(theme)
    applyTheme(next)
    setTheme(next)
  }

  const isDark = theme === 'mercury'
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Mercury Light' : 'Mercury'}
      className="theme-card theme-border grid h-9 w-9 place-items-center rounded-lg border text-base transition-colors hover:border-[var(--theme-accent-border)]"
    >
      <span className="theme-text">{isDark ? '☾' : '☀'}</span>
    </button>
  )
}
