import { usePolling } from './polling.ts'
import type { OfficeSnapshot } from './types.ts'

const VIEWER_KEY = 'mc.viewerId'

/**
 * Stable random id for this browser tab (sessionStorage, so each tab counts
 * as one viewer and a reload keeps the same id). Empty outside a browser
 * (server render, tests) — the server then simply does not count the poll.
 * No identity is carried: the id is random and never leaves /api/office.
 */
export function viewerId(): string {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return ''
  try {
    const existing = window.sessionStorage.getItem(VIEWER_KEY)
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(VIEWER_KEY, id)
    return id
  } catch {
    return ''
  }
}

/** /api/office path carrying this tab's viewer id, so the server can count live viewers. */
export function officePollPath(): string {
  const id = viewerId()
  return id ? `/api/office?viewer=${encodeURIComponent(id)}` : '/api/office'
}

/** Live viewer count from the office snapshot; undefined until the first poll lands. */
export function useViewers(): number | undefined {
  const office = usePolling<OfficeSnapshot>(officePollPath(), 10_000)
  return office.status === 'ready' ? office.data.viewersNow : undefined
}
