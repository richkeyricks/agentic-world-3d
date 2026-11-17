// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyPublicTheme, initialPublicTheme, PUBLIC_THEME_KEY } from './preferences.ts'

describe('applyPublicTheme', () => {
  it('defaults the public view to day when no theme was chosen', () => {
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
    window.localStorage.removeItem('mc.theme')
    document.documentElement.dataset.theme = 'dark'
    applyPublicTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('respects a stored public dark choice', () => {
    window.localStorage.setItem(PUBLIC_THEME_KEY, 'dark')
    document.documentElement.dataset.theme = 'dark'
    applyPublicTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
  })

  it('does not store the public default', () => {
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
    applyPublicTheme()
    expect(window.localStorage.getItem(PUBLIC_THEME_KEY)).toBeNull()
  })

  it('ignores a stored ADMIN dark choice in the public view (Ricky case)', () => {
    // Ricky's browser has mc.theme=dark from the admin view; the public
    // view must still open in daylight.
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
    window.localStorage.setItem('mc.theme', 'dark')
    document.documentElement.dataset.theme = 'dark'
    applyPublicTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
    window.localStorage.removeItem('mc.theme')
  })
})

describe('initialPublicTheme', () => {
  it('returns light when nothing was chosen', () => {
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
    expect(initialPublicTheme()).toBe('light')
  })

  it('returns the stored public choice', () => {
    window.localStorage.setItem(PUBLIC_THEME_KEY, 'dark')
    expect(initialPublicTheme()).toBe('dark')
    window.localStorage.removeItem(PUBLIC_THEME_KEY)
  })
})
