import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { easeNightAmount, lerpHex, mix, particleCountForWidth } from './day-night.tsx'

describe('easeNightAmount', () => {
  it('moves towards the target without overshooting', () => {
    let value = 0
    for (let step = 0; step < 300; step += 1) value = easeNightAmount(value, 1, 0.016)
    expect(value).toBe(1)
    expect(value).toBeLessThanOrEqual(1)
  })

  it('reaches ~95% within about 2 s at the default rate', () => {
    let value = 0
    for (let step = 0; step < 120; step += 1) value = easeNightAmount(value, 1, 1 / 60)
    expect(value).toBeGreaterThan(0.9)
  })

  it('eases back to day the same way', () => {
    let value = 1
    for (let step = 0; step < 300; step += 1) value = easeNightAmount(value, 0, 0.016)
    expect(value).toBe(0)
  })

  it('does not move when already at the target', () => {
    expect(easeNightAmount(1, 1, 0.5)).toBe(1)
    expect(easeNightAmount(0, 0, 0.5)).toBe(0)
  })

  it('is monotonic frame by frame', () => {
    let value = 0
    let previous = value
    for (let step = 0; step < 60; step += 1) {
      value = easeNightAmount(value, 1, 1 / 60)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('mix', () => {
  it('lerps intensities', () => {
    expect(mix(2.4, 0.75, 0)).toBe(2.4)
    expect(mix(2.4, 0.75, 1)).toBe(0.75)
    expect(mix(2.4, 0.75, 0.5)).toBeCloseTo(1.575, 10)
  })
})

describe('lerpHex', () => {
  it('mixes two colours', () => {
    const color = new THREE.Color()
    lerpHex(color, '#ffffff', '#000000', 0.5)
    expect(color.r).toBeCloseTo(0.5, 2)
    expect(color.g).toBeCloseTo(0.5, 2)
  })
})

describe('particleCountForWidth', () => {
  it('uses fewer points on small screens', () => {
    expect(particleCountForWidth(390)).toBe(800)
    expect(particleCountForWidth(800)).toBe(2000)
    expect(particleCountForWidth(1920)).toBe(4000)
  })
})
