import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViewersChip } from './ui.tsx'
import { officePollPath, viewerId } from './viewers.ts'

describe('viewer id', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('is stable per tab and stored in sessionStorage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } } })
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-3333-4444-555555555555' })
    expect(viewerId()).toBe('11111111-2222-3333-4444-555555555555')
    expect(viewerId()).toBe('11111111-2222-3333-4444-555555555555')
    expect(store.get('mc.viewerId')).toBe('11111111-2222-3333-4444-555555555555')
    expect(officePollPath()).toBe('/api/office?viewer=11111111-2222-3333-4444-555555555555')
  })

  it('falls back to plain /api/office without a window', () => {
    expect(viewerId()).toBe('')
    expect(officePollPath()).toBe('/api/office')
  })
})

describe('ViewersChip', () => {
  it('shows the count and nothing else', () => {
    const markup = renderToStaticMarkup(<ViewersChip count={3}/>)
    expect(markup).toContain('3')
    expect(markup).toContain('sedang menonton')
    expect(markup).toContain('👁')
  })

  it('renders nothing before the first poll', () => {
    expect(renderToStaticMarkup(<ViewersChip count={undefined}/>)).toBe('')
  })
})
