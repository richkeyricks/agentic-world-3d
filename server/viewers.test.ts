import { describe, expect, it } from 'vitest'
import { MAX_VIEWERS, VIEWER_WINDOW_MS, noteViewer, pruneViewers } from './viewers.js'

describe('live viewer counter', () => {
  it('counts distinct tabs once each', () => {
    const seen = new Map<string, number>()
    expect(noteViewer(seen, 'viewer-aaaa', 1_000)).toBe(1)
    expect(noteViewer(seen, 'viewer-bbbb', 2_000)).toBe(2)
    expect(noteViewer(seen, 'viewer-aaaa', 3_000)).toBe(2)
  })

  it('drops viewers silent for more than 30s', () => {
    const seen = new Map<string, number>()
    noteViewer(seen, 'viewer-aaaa', 1_000)
    noteViewer(seen, 'viewer-bbbb', 2_000)
    expect(noteViewer(seen, 'viewer-bbbb', 1_000 + VIEWER_WINDOW_MS + 1)).toBe(1)
    expect(noteViewer(seen, 'viewer-cccc', 1_000 + VIEWER_WINDOW_MS + 2)).toBe(2)
  })

  it('keeps viewers seen inside the window', () => {
    const seen = new Map<string, number>()
    noteViewer(seen, 'viewer-aaaa', 1_000)
    expect(noteViewer(seen, 'viewer-bbbb', 1_000 + VIEWER_WINDOW_MS)).toBe(2)
  })

  it('ignores missing and malformed ids', () => {
    const seen = new Map<string, number>()
    expect(noteViewer(seen, undefined, 1_000)).toBe(0)
    expect(noteViewer(seen, '', 1_000)).toBe(0)
    expect(noteViewer(seen, 'short', 1_000)).toBe(0)
    expect(noteViewer(seen, 'a'.repeat(65), 1_000)).toBe(0)
    expect(noteViewer(seen, 'viewer aaaa', 1_000)).toBe(0)
    expect(noteViewer(seen, '../../etc/passwd', 1_000)).toBe(0)
    expect(seen.size).toBe(0)
  })

  it('prunes stale entries', () => {
    const seen = new Map<string, number>([['viewer-aaaa', 1_000], ['viewer-bbbb', 40_000]])
    pruneViewers(seen, 45_000)
    expect([...seen.keys()]).toEqual(['viewer-bbbb'])
  })

  it('caps the registry against abuse', () => {
    const seen = new Map<string, number>()
    expect(noteViewer(seen, 'viewer-aaaa', 1_000, VIEWER_WINDOW_MS, 2)).toBe(1)
    expect(noteViewer(seen, 'viewer-bbbb', 2_000, VIEWER_WINDOW_MS, 2)).toBe(2)
    expect(noteViewer(seen, 'viewer-cccc', 3_000, VIEWER_WINDOW_MS, 2)).toBe(2)
    expect(seen.has('viewer-cccc')).toBe(true)
    expect(seen.has('viewer-aaaa')).toBe(false)
    expect(MAX_VIEWERS).toBeGreaterThan(0)
  })
})
