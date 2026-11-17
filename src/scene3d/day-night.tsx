// Day ↔ night for the 3D office: one shared, lerped "night amount" (0 = day,
// 1 = night) instead of a boolean switch. The Lighting component eases it
// towards the theme's target every frame (~1-2 s); every glow in the scene
// (windows, lamps, signs) reads the same value, so the whole office fades
// between day and evening together instead of flipping at once.

import { useFrame } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'

/** The current position of the day→night transition. Mutated by Lighting's
    useFrame; read (never set) by every emissive component. */
export const nightAmount = { current: 0 }

/** How fast the transition runs (exponential approach): 1.4/s reaches ~95%
    in about 2 s. */
export const NIGHT_EASE_RATE = 1.4

/** Ease `current` towards `target` (0 or 1) by `dt` seconds. Never overshoots;
    snaps when close enough that the difference is invisible. */
export function easeNightAmount(current: number, target: number, dt: number, rate = NIGHT_EASE_RATE): number {
  const next = current + (target - current) * (1 - Math.exp(-rate * Math.max(dt, 0)))
  return Math.abs(target - next) < 0.002 ? target : next
}

/** Plain number lerp, for light intensities. */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Palette: the day values are the ones the scene already used; the night
// values match the existing evening lighting.
export const DAY_NIGHT = {
  sky: { topDay: '#4f9fd8', topNight: '#0a1424', horizonDay: '#bfe0ef', horizonNight: '#24344d', fogDay: '#bfe0ef', fogNight: '#1a2335' },
  hemi: { skyDay: '#fff4e0', skyNight: '#7f95bd', groundDay: '#5d7a4c', groundNight: '#1e2620', day: 1.1, night: 0.32 },
  sun: { colorDay: '#fff1d6', colorNight: '#ff9a5a', day: 2.4, night: 0.75 },
  ambient: { colorDay: '#ffffff', colorNight: '#8fa4d8', day: 0.35, night: 0.14 },
} as const

// Scratch colours so the per-frame lerps never allocate.
const scratchA = new THREE.Color()
const scratchB = new THREE.Color()

/** Lerp `color` between the day and night hex values at `t` (0..1). */
export function lerpHex(color: THREE.Color, day: string, night: string, t: number): THREE.Color {
  return color.lerpColors(scratchA.set(day), scratchB.set(night), t)
}

/** Drive a standard material's emissive glow from the shared night amount:
    colour and intensity both fade between their day and night values. */
export function useNightMaterial(
  material: MutableRefObject<THREE.MeshStandardMaterial | null>,
  dayColor: string,
  nightColor: string,
  dayIntensity: number,
  nightIntensity: number,
): void {
  useFrame(() => {
    const mat = material.current
    if (!mat) return
    const t = nightAmount.current
    lerpHex(mat.emissive, dayColor, nightColor, t)
    mat.emissiveIntensity = mix(dayIntensity, nightIntensity, t)
  })
}

/** A point light that only exists at night — but fades in and out with the
    transition instead of popping. While the night amount is ~0 the light is
    invisible, so it costs nothing in the day render (three skips invisible
    lights entirely). Replaces the old `{night && <pointLight/>}` pattern. */
export function NightLight({ position, color, intensity, distance }: { position: [number, number, number]; color: string; intensity: number; distance: number }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const current = light.current
    if (!current) return
    const t = nightAmount.current
    current.intensity = intensity * t
    current.visible = t > 0.02
  })
  return <pointLight ref={light} position={position} color={color} intensity={0} distance={distance} decay={2}/>
}

/** Ambient particle budget: fewer points on small screens (the RainEffect
    pattern: 800 / 2000 / 4000). One THREE.Points draw call either way. */
export function particleCountForWidth(width: number): number {
  if (width < 700) return 800
  if (width < 1200) return 2000
  return 4000
}
