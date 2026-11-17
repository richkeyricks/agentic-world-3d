import * as THREE from 'three'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { povEyeHeight, povView } from './camera-math.ts'
import { PovBar } from './pages/Office3D.tsx'
import type { OfficeStation } from './types.ts'

describe('povEyeHeight', () => {
  it('is standing height by default', () => {
    expect(povEyeHeight(undefined, false)).toBe(1.55)
  })

  it('is lower when sitting, on a chair or on the floor', () => {
    expect(povEyeHeight(undefined, true)).toBe(1.1)
    expect(povEyeHeight('floor', false)).toBe(1.1)
  })

  it('is just above the surface when lying down', () => {
    expect(povEyeHeight('lie', false)).toBe(0.75)
  })
})

describe('povView', () => {
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  it('puts the eye above the feet and looks along the facing direction', () => {
    const { eye, target } = povView(at(2, 0, 3), 0, 1.55)
    expect(eye.toArray()).toEqual([2, 1.55, 3])
    // Heading 0 faces local +z, so the target is one step ahead in +z.
    expect(target.toArray()).toEqual([2, 1.55, 4])
  })

  it('turns with the heading: PI/2 faces +x, PI faces -z', () => {
    expect(povView(at(0, 0, 0), Math.PI / 2, 1.55).target.toArray()[0]).toBeCloseTo(1)
    expect(povView(at(0, 0, 0), Math.PI, 1.55).target.toArray()[2]).toBeCloseTo(-1)
  })

  it('keeps the floor height for an agent upstairs', () => {
    const { eye } = povView(at(1, 2.8, -2), 0, 1.55)
    expect(eye.y).toBeCloseTo(4.35)
  })
})

const stations: Pick<OfficeStation, 'id' | 'name'>[] = [
  { id: 'isa', name: 'ISA' },
  { id: 'neo', name: 'NEO AI' },
]

describe('PovBar', () => {
  it('lists every agent as a chip to see through their eyes', () => {
    const markup = renderToStaticMarkup(<PovBar stations={stations as OfficeStation[]} activeId={null} onEnter={() => {}} onExit={() => {}}/>)
    expect(markup).toContain('Lihat dari mata')
    expect(markup).toContain('ISA')
    expect(markup).toContain('NEO AI')
    expect(markup).not.toContain('Keluar dari POV')
  })

  it('marks the active agent and offers the exit when in POV', () => {
    const markup = renderToStaticMarkup(<PovBar stations={stations as OfficeStation[]} activeId="isa" onEnter={() => {}} onExit={() => {}}/>)
    expect(markup).toContain('Melihat dari mata ISA')
    expect(markup).toContain('Keluar dari POV')
    expect(markup).toContain('aria-pressed="true"')
  })
})
