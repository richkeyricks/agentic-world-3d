import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeStored(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage may be blocked */ }
}

export function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = readStored('mc.theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Theme preference, remembered per browser. */
export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStored('mc.theme', theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
  }
}

/** Public view: day by default. The public theme lives in its own key
    (mc.publicTheme), separate from the admin's mc.theme — so a visitor who
    chose dark in the admin view (or whose OS is dark) still sees the public
    office in daylight, as Ricky asked. */
export const PUBLIC_THEME_KEY = 'mc.publicTheme'

export function initialPublicTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = readStored(PUBLIC_THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'light'
}

/** Public theme preference, remembered per browser (own key, see above). */
export function usePublicTheme() {
  const [theme, setTheme] = useState<Theme>(initialPublicTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStored(PUBLIC_THEME_KEY, theme)
  }, [theme])

  return {
    theme,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
  }
}

/** Public view: apply the public theme (day by default) without storing it.
    Kept for the initial paint; the toggle in the public header is usePublicTheme. */
export function applyPublicTheme(): void {
  if (typeof window === 'undefined') return
  document.documentElement.dataset.theme = initialPublicTheme()
}
