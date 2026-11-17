import { describe, expect, it } from 'vitest'
import { createLayout, MARKET } from '../office3d-layout.ts'
import { promoterLoop } from './promoter-route.ts'

const MARGIN = 0.3

/** Points along a straight leg, spaced at most 0.25 apart. */
function samples(a: [number, number], b: [number, number]): [number, number][] {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25))
  return Array.from({ length: steps + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps] as [number, number])
}

describe('Ricky the promoter route', () => {
  it.each([3, 7])('the loop stays on open ground for a %s-agent crew', (agents) => {
    const layout = createLayout(agents)
    const loop = promoterLoop(layout)
    const { minX, maxX, minZ, maxZ } = layout.building
    const legs: [number, number][][] = loop.map((point, index) => [point, loop[(index + 1) % loop.length]])
    for (const [a, b] of legs) {
      for (const [x, z] of samples(a, b)) {
        // Inside the grounds.
        expect(x).toBeGreaterThanOrEqual(-20)
        expect(x).toBeLessThanOrEqual(29)
        expect(z).toBeGreaterThanOrEqual(-8)
        expect(z).toBeLessThanOrEqual(18)
        // Outside the office building (with margin).
        const inBuilding = x > minX - MARGIN && x < maxX + MARGIN && z > minZ - MARGIN && z < maxZ + MARGIN
        expect(inBuilding).toBe(false)
        // Outside Ricky Market (with margin).
        const inMarket = x > MARKET.minX - MARGIN && x < MARKET.maxX + MARGIN && z > MARKET.minZ - MARGIN && z < MARKET.maxZ + MARGIN
        expect(inMarket).toBe(false)
      }
    }
  })

  it('the loop crosses the road, reaches behind the office, and goes up the gang', () => {
    const loop = promoterLoop(createLayout(7))
    // A point on the far side of the road (road: z 9.6..14.6).
    expect(loop.some(([, z]) => z > 14.6)).toBe(true)
    // A point behind the office (back wall at z -5.2).
    expect(loop.some(([, z]) => z < -5.2)).toBe(true)
    // A point east of the market frontage.
    expect(loop.some(([x]) => x > 26)).toBe(true)
    // The gang leg runs on the real gang lane, clear of the carts by construction.
    const layout = createLayout(7)
    expect(loop).toContainEqual([layout.sideLaneX, 7.0])
    expect(loop).toContainEqual([layout.sideLaneX, -6.3])
  })

  it('the loop is closed: the last leg walks back to the start', () => {
    const loop = promoterLoop(createLayout(7))
    expect(loop.length).toBeGreaterThanOrEqual(8)
    expect(loop[0]).toEqual([2, 5.9])
  })
})
