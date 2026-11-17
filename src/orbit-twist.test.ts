// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { wrapAngleDelta } from './camera-math.ts'

// Regression test for the two-finger twist bug Ricky reported (2026-11-17):
// in public mode the twist only pinch-zoomed, never rotated. Two causes, both
// proven here against the real OrbitControls (three 0.186):
//  1. enableRotate=false skips the rotate half of DOLLY_ROTATE entirely.
//  2. Even with enableRotate on, DOLLY_ROTATE rotates from the MIDPOINT's
//     displacement — a pure twist (midpoint still) rotates nothing by design.

function makeElement(): HTMLElement {
  const el = document.createElement('div')
  // jsdom has no layout or pointer capture: stub what OrbitControls touches.
  Object.defineProperty(el, 'clientWidth', { value: 800 })
  Object.defineProperty(el, 'clientHeight', { value: 600 })
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  const stub = el as unknown as { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void }
  stub.setPointerCapture = () => {}
  stub.releasePointerCapture = () => {}
  document.body.appendChild(el)
  return el
}

function pointerEvent(type: string, id: number, x: number, y: number): Event {
  const Ctor = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? window.MouseEvent
  const event = new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }) as MouseEvent & { pointerId: number; pointerType: string; isPrimary: boolean }
  Object.defineProperty(event, 'pointerId', { value: id })
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  Object.defineProperty(event, 'isPrimary', { value: id === 1 })
  // OrbitControls reads pageX/pageY, which jsdom derives from clientX + scroll.
  Object.defineProperty(event, 'pageX', { value: x })
  Object.defineProperty(event, 'pageY', { value: y })
  return event as unknown as Event
}

function makeControls(enableRotate: boolean): { el: HTMLElement; controls: OrbitControls } {
  const el = makeElement()
  const camera = new THREE.PerspectiveCamera(40, 800 / 600, 0.5, 150)
  camera.position.set(-3, 13, 16)
  const controls = new OrbitControls(camera, el)
  controls.enableRotate = enableRotate
  controls.enableZoom = true
  controls.enablePan = true
  controls.touches.ONE = THREE.TOUCH.PAN
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
  controls.update()
  return { el, controls }
}

function endGesture(el: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  document.dispatchEvent(pointerEvent('pointerup', 1, x1, y1))
  document.dispatchEvent(pointerEvent('pointerup', 2, x2, y2))
  el.remove()
}

/** Move both fingers in small alternating steps, keeping them apart: if one
    finger ever lands exactly on the other, the pinch distance hits zero and
    the dolly scale divides by zero. Real fingers stay apart while dragging. */
function dragBoth(from1: [number, number], to1: [number, number], from2: [number, number], to2: [number, number], steps = 4) {
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    document.dispatchEvent(pointerEvent('pointermove', 1, from1[0] + (to1[0] - from1[0]) * t, from1[1] + (to1[1] - from1[1]) * t))
    document.dispatchEvent(pointerEvent('pointermove', 2, from2[0] + (to2[0] - from2[0]) * t, from2[1] + (to2[1] - from2[1]) * t))
  }
}

describe('two-finger DOLLY_ROTATE in OrbitControls', () => {
  it('rotates on a two-finger drag when enableRotate is on', () => {
    const { el, controls } = makeControls(true)
    const before = controls.getAzimuthalAngle()
    el.dispatchEvent(pointerEvent('pointerdown', 1, 350, 300))
    el.dispatchEvent(pointerEvent('pointerdown', 2, 450, 300))
    // Both fingers swipe right together: the midpoint moves +100px in x.
    dragBoth([350, 300], [450, 300], [450, 300], [550, 300])
    controls.update()
    const after = controls.getAzimuthalAngle()
    endGesture(el, 450, 300, 550, 300)
    controls.dispose()
    expect(Math.abs(after - before)).toBeGreaterThan(0.5)
  })

  it('does NOT rotate on the same drag when enableRotate is off (the public-mode bug)', () => {
    const { el, controls } = makeControls(false)
    const before = controls.getAzimuthalAngle()
    el.dispatchEvent(pointerEvent('pointerdown', 1, 350, 300))
    el.dispatchEvent(pointerEvent('pointerdown', 2, 450, 300))
    dragBoth([350, 300], [450, 300], [450, 300], [550, 300])
    controls.update()
    const after = controls.getAzimuthalAngle()
    endGesture(el, 450, 300, 550, 300)
    controls.dispose()
    // Unchanged up to floating-point noise from damping decay.
    expect(after).toBeCloseTo(before, 10)
  })

  it('a pure twist (midpoint still) rotates ~nothing even with enableRotate on', () => {
    const { el, controls } = makeControls(true)
    const before = controls.getAzimuthalAngle()
    el.dispatchEvent(pointerEvent('pointerdown', 1, 350, 300))
    el.dispatchEvent(pointerEvent('pointerdown', 2, 450, 300))
    // Fingers circle each other 90° around the same midpoint (400, 300).
    document.dispatchEvent(pointerEvent('pointermove', 1, 400, 250))
    document.dispatchEvent(pointerEvent('pointermove', 2, 400, 350))
    controls.update()
    const after = controls.getAzimuthalAngle()
    endGesture(el, 400, 250, 400, 350)
    controls.dispose()
    // The intermediate midpoints shift a little as the fingers move one at a
    // time, but the net rotation is ~zero: the library never measures the
    // angle between the fingers. That is why the office tracks it itself.
    expect(Math.abs(after - before)).toBeLessThan(0.1)
  })
})

describe('wrapAngleDelta', () => {
  it('keeps small changes and wraps across the -PI/PI seam', () => {
    expect(wrapAngleDelta(0.5)).toBe(0.5)
    expect(wrapAngleDelta(-0.5)).toBe(-0.5)
    expect(wrapAngleDelta(Math.PI + 0.2)).toBeCloseTo(-Math.PI + 0.2, 10)
    expect(wrapAngleDelta(-Math.PI - 0.2)).toBeCloseTo(Math.PI - 0.2, 10)
  })
})
