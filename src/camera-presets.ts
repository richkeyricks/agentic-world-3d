// Camera presets + fly-through intro (Q7). Pure data and math, so the views
// are unit-testable: every preset stays inside the OrbitControls limits
// (distance 5..72, polar angle 0.2..1.32 rad), so the controls never snap a
// preset view back after the flight ends. 'Depan' is the default view and is
// resolved from the layout at runtime, so it is not listed here.

import type { Vec3 } from './office3d-layout.ts'

export interface CameraView { position: Vec3; target: Vec3 }

/** The OrbitControls limits in Office3D (kept in sync with Controls). */
export const CAMERA_LIMITS = { minDistance: 5, maxDistance: 72, minPolar: 0.2, maxPolar: 1.32 } as const

/** How long the intro fly-through takes, and one preset hop. */
export const INTRO_DURATION_MS = 3000
export const PRESET_FLIGHT_MS = 1200
/** sessionStorage flag: the intro plays once per browser session. */
export const INTRO_SEEN_KEY = 'mc.introSeen'

export function introSeen(): boolean {
  try { return sessionStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { return false }
}

export function markIntroSeen(): void {
  try { sessionStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* per-browser convenience only */ }
}

export const CAMERA_PRESETS: { id: 'jalan' | 'pasar' | 'atas'; label: string; title: string; view: CameraView }[] = [
  { id: 'jalan', label: 'Jalan', title: 'Dari jalan, melihat kantor dari depan', view: { position: [0, 7, 23], target: [1.5, 1.2, 4] } },
  { id: 'pasar', label: 'Pasar', title: 'Dari depan Ricky Market', view: { position: [31, 8, 17], target: [23, 1.8, 0] } },
  { id: 'atas', label: 'Atas', title: 'Dari atas, seluruh kantor dan jalan', view: { position: [-4, 26, 24], target: [6, 0, 2] } },
]

/** The intro starts far and high above `target`, then eases into the default view. */
export function introStartView(target: Vec3): CameraView {
  return { position: [target[0] + 22, target[1] + 21, target[2] + 34], target }
}

/** Smoothstep easing for flights: slow at both ends, steady in the middle. */
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1)
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

/** Camera distance and polar angle of a view, for the limits checks. */
export function viewDistance(view: CameraView): number {
  const [px, py, pz] = view.position
  const [tx, ty, tz] = view.target
  return Math.hypot(px - tx, py - ty, pz - tz)
}

export function viewPolar(view: CameraView): number {
  const [px, py, pz] = view.position
  const [tx, ty, tz] = view.target
  return Math.atan2(Math.hypot(px - tx, pz - tz), py - ty)
}
