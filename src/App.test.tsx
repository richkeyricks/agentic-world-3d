import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { entryView } from './entry-view.ts'
import { LockScreen } from './LockScreen.tsx'
import type { AccessStatus } from './access.ts'

const locked: AccessStatus = { enabled: true, unlocked: false, minLength: 12, rememberDays: 7 }
const unlocked: AccessStatus = { enabled: true, unlocked: true, minLength: 12, rememberDays: 7 }
const disabled: AccessStatus = { enabled: false, unlocked: false, minLength: 12, rememberDays: 7 }

describe('entryView — public is the default', () => {
  it('shows the public view at the root URL with no query, once access is checked', () => {
    expect(entryView({ search: '', checked: true, access: locked })).toBe('public')
  })

  it('shows the lock screen at the root URL only when admin is requested', () => {
    expect(entryView({ search: '?admin=1', checked: true, access: locked })).toBe('lock')
  })

  it('loads the admin view when the device is already unlocked', () => {
    expect(entryView({ search: '', checked: true, access: unlocked })).toBe('admin')
    expect(entryView({ search: '?admin=1', checked: true, access: unlocked })).toBe('admin')
  })

  it('keeps ?public=1 working as the public view', () => {
    expect(entryView({ search: '?public=1', checked: false, access: undefined })).toBe('public')
    expect(entryView({ search: '?public=1#/office', checked: true, access: locked })).toBe('public')
    expect(entryView({ search: '?public=1', checked: true, access: unlocked })).toBe('public')
  })

  it('waits for the access check before deciding, except for ?public=1', () => {
    expect(entryView({ search: '', checked: false, access: undefined })).toBe('loading')
    expect(entryView({ search: '?admin=1', checked: false, access: undefined })).toBe('loading')
  })

  it('loads the admin view when no access code is set (or the server cannot be reached)', () => {
    expect(entryView({ search: '', checked: true, access: disabled })).toBe('admin')
    expect(entryView({ search: '', checked: true, access: undefined })).toBe('admin')
  })
})

describe('LockScreen', () => {
  it('offers a way back to the public view', () => {
    const markup = renderToStaticMarkup(<LockScreen status={locked} onUnlocked={() => {}} />)
    expect(markup).toContain('Lihat tampilan publik')
    expect(markup).toContain('href="/"')
    expect(markup).toContain('Enter access code')
  })
})
