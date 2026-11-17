// Live viewer counter for the Mission Control ISA header.
//
// How it counts: every browser tab that has the office open polls /api/office
// every 10s and sends a random per-tab id (sessionStorage, `mc.viewerId`).
// The server keeps an in-memory map of id -> last-seen timestamp and reports
// how many ids were seen in the last VIEWER_WINDOW_MS (30s).
//
// Why a per-tab id, not the client IP: every visitor arrives through an SSH
// tunnel (serveo / localhost.run), so the server sees all of them as
// 127.0.0.1 — IP counting would always read 1. The id is random, carries no
// identity, is never stored to disk, and expires after 30s of silence.
//
// Honest limits: this is an approximation, not an exact headcount. One person
// with two tabs counts twice; a tab in the background pauses its polling
// (document.hidden) and drops out after ~30s; a visitor whose tab only just
// opened is counted on its first poll. No cookies, no analytics service, no
// personal data beyond the short-lived in-memory set below.

export const VIEWER_WINDOW_MS = 30_000
export const VIEWER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
export const MAX_VIEWERS = 10_000

/** Drop ids not seen within the window. */
export function pruneViewers(seen: Map<string, number>, now: number, windowMs = VIEWER_WINDOW_MS): void {
  for (const [id, at] of seen) if (now - at > windowMs) seen.delete(id)
}

/** Record one poll and return the live viewer count. Invalid ids are ignored. */
export function noteViewer(seen: Map<string, number>, id: string | undefined, now: number, windowMs = VIEWER_WINDOW_MS, max = MAX_VIEWERS): number {
  pruneViewers(seen, now, windowMs)
  if (typeof id === 'string' && VIEWER_ID_PATTERN.test(id)) {
    if (!seen.has(id) && seen.size >= max) {
      // Bound the map against abuse: drop the stalest entry to make room.
      let oldest: string | undefined
      let oldestAt = Infinity
      for (const [key, at] of seen) if (at < oldestAt) { oldest = key; oldestAt = at }
      if (oldest !== undefined) seen.delete(oldest)
    }
    seen.set(id, now)
  }
  return seen.size
}

/** The live viewer registry used by the /api/office route. */
const liveViewers = new Map<string, number>()

export function recordViewer(id: string | undefined, now = Date.now()): number {
  return noteViewer(liveViewers, id, now)
}
