import { describe, expect, it } from 'vitest'
import { CAMERA_LIMITS, CAMERA_PRESETS, easeInOutCubic, introStartView, viewDistance, viewPolar } from './camera-presets.ts'
import { createLayout } from './office3d-layout.ts'

describe('camera presets', () => {
  // The crew today is 7 agents; the pan bounds grow with the crew, so check
  // against that layout (the smallest bounds that still have to hold).
  const pan = createLayout(7).pan

  it('every preset stays inside the OrbitControls limits', () => {
    for (const preset of CAMERA_PRESETS) {
      const distance = viewDistance(preset.view)
      expect(distance).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance)
      expect(distance).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance)
      const polar = viewPolar(preset.view)
      expect(polar).toBeGreaterThanOrEqual(CAMERA_LIMITS.minPolar)
      expect(polar).toBeLessThanOrEqual(CAMERA_LIMITS.maxPolar)
    }
  })

  it('every preset target stays inside the pan bounds', () => {
    for (const preset of CAMERA_PRESETS) {
      const [x, , z] = preset.view.target
      expect(x).toBeGreaterThanOrEqual(pan.minX)
      expect(x).toBeLessThanOrEqual(pan.maxX)
      expect(z).toBeGreaterThanOrEqual(pan.minZ)
      expect(z).toBeLessThanOrEqual(pan.maxZ)
    }
  })

  it('the intro start also stays inside the limits', () => {
    const target = [-0.3, 0.6, 0.2] as [number, number, number]
    const start = introStartView(target)
    expect(viewDistance(start)).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance)
    expect(viewPolar(start)).toBeGreaterThanOrEqual(CAMERA_LIMITS.minPolar)
    expect(viewPolar(start)).toBeLessThanOrEqual(CAMERA_LIMITS.maxPolar)
    expect(start.target).toEqual(target)
  })
})

describe('easeInOutCubic', () => {
  it('starts at 0, ends at 1, passes through 0.5', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBe(0.5)
  })

  it('is monotonic', () => {
    let previous = 0
    for (let step = 1; step <= 20; step += 1) {
      const value = easeInOutCubic(step / 20)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})
