import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { applyTheme, getStoredTheme, toggleVariant, type ThemeId } from '@/lib/theme'

// Dark/light switch for the two Mercury modes. Reuses the Button primitive.
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
    <Button
      variant="outline"
      size="sm"
      onClick={flip}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Mercury Light' : 'Mercury'}
      className="w-9 px-0 text-base"
    >
      {isDark ? '☾' : '☀'}
    </Button>
  )
}
