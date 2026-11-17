// Ricky the promoter: a NEW scene character (not an agent, not a vendor) who
// walks a loop around ALL the buildings — the office and Ricky Market, including
// the back of the office — and crosses the road to the far side and back. He
// carries a small promo board (RICHKEYRICK — FOLLOW • SUBSCRIBE) and wears a
// gold shirt, so he reads as a promoter at a glance. He is a scene character:
// he never appears in the Agents list and has no % bar.
//
// He sometimes pops into Ricky Market to browse (same pattern as the
// pedestrians). His position is written to `positionRef` every frame, so the
// UFO task can hook into it (he is one of its victims) and so verification
// can read where he is.
//
// When the UFO takes him, he freezes under the beam, rises up it, vanishes
// inside the ship, and comes back down at a DIFFERENT place — a waypoint of
// his own loop, far from where he was taken — then resumes his route from
// there, as if nothing happened.

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { MARKET_ENTRY_X, SIDEWALK_Z, walkPath, type OfficeLayout } from '../office3d-layout.ts'
import { RBox } from './props.tsx'
import { signTextureFit } from './textures.ts'
import type { RegisterAnchor } from './traffic.tsx'
import type { UfoAbduction } from './ufo-state.ts'
import {
  PROMOTER_BROWSE_MAX_S,
  PROMOTER_BROWSE_MIN_S,
  PROMOTER_DIVERT_CHANCE,
  PROMOTER_MARKET_FRONTAGE,
  PROMOTER_WALK_SPEED,
  promoterLoop,
} from './promoter-route.ts'

const random = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

// Legs and arms pivot at the hip / shoulder: translate the geometry so its top sits at the origin.
const legGeometry = new THREE.BoxGeometry(0.17, 0.62, 0.2).translate(0, -0.31, 0)
const armGeometry = new THREE.BoxGeometry(0.12, 0.52, 0.14).translate(0, -0.26, 0)

/** Where he is in his route: walking the loop, or on a market detour. */
export interface PromoterPosition { x: number; y: number; z: number }

type PromoterPhase = 'walk' | 'toMarket' | 'browse' | 'toSidewalk'

interface PromoterState {
  phase: PromoterPhase
  path: THREE.Vector3[]
  loopIndex: number
  diverted: boolean
  wasInFrontage: boolean
  spot: { position: [number, number, number]; facing: number } | null
  until: number
}

export function PromoterRicky({ layout, registerAnchor, positionRef, abductionRef }: {
  layout: OfficeLayout
  registerAnchor: RegisterAnchor
  positionRef: MutableRefObject<PromoterPosition | null>
  abductionRef: MutableRefObject<UfoAbduction | null>
}) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Mesh>(null)
  const rightArm = useRef<THREE.Mesh>(null)
  const loop = useMemo(() => promoterLoop(layout), [layout])
  const marketSpots = layout.idleStops.find((item) => item.key === 'market')!.spots
  /** True once the drop-off reset ran, so it runs once per abduction. */
  const dropReset = useRef(false)
  const state = useRef<PromoterState>({
    phase: 'walk',
    path: [new THREE.Vector3(loop[1][0], 0, loop[1][1])],
    loopIndex: 1,
    diverted: false,
    wasInFrontage: false,
    spot: null,
    until: 0,
  })
  const board = useMemo(() => signTextureFit('RICHKEYRICK', '#16283d', '#d8b36a', 'FOLLOW • SUBSCRIBE'), [])

  useFrame(({ clock }, delta) => {
    const group = root.current
    if (!group) return
    const t = clock.elapsedTime
    const prom = state.current
    // Abducted: the UFO owns the body now — freeze under the beam, rise up it,
    // hide inside the ship, come back down somewhere else, then walk on.
    const abduction = abductionRef.current
    if (abduction?.victim === 'ricky') {
      if (abduction.phase === 'frozen') {
        // Trembling on the spot, arms half raised at the light.
        if (leftArm.current && rightArm.current) {
          leftArm.current.rotation.x = -2.2 + Math.sin(t * 12) * 0.15
          rightArm.current.rotation.x = -2.2 + Math.cos(t * 12) * 0.15
        }
      } else if (abduction.phase === 'lift') {
        group.position.y = abduction.liftY
        if (leftLeg.current && rightLeg.current) { leftLeg.current.rotation.x = 0.25; rightLeg.current.rotation.x = -0.15 }
        if (leftArm.current && rightArm.current) { leftArm.current.rotation.x = -2.6; rightArm.current.rotation.x = -2.6 }
        if (body.current) body.current.position.y = Math.sin(t * 6) * 0.05
      } else if (abduction.phase === 'carried') {
        group.visible = false
      } else if (abduction.phase === 'drop') {
        if (!dropReset.current) {
          // Dropped somewhere else: resume the loop from the waypoint nearest
          // the drop point, so he walks on from there.
          let best = 0
          let bestDistance = Infinity
          loop.forEach(([x, z], i) => {
            const distance = (x - abduction.dropX) ** 2 + (z - abduction.dropZ) ** 2
            if (distance < bestDistance) { bestDistance = distance; best = i }
          })
          prom.loopIndex = best
          prom.phase = 'walk'
          prom.path = [new THREE.Vector3(loop[best][0], 0, loop[best][1])]
          prom.diverted = false
          prom.spot = null
          dropReset.current = true
        }
        group.visible = true
        group.position.set(abduction.dropX, abduction.liftY, abduction.dropZ)
      }
      // Where he is, for the UFO and for verification (y shows the lift).
      positionRef.current = { x: group.position.x, y: group.position.y, z: group.position.z }
      return
    }
    if (dropReset.current) {
      // Back on the ground, back to normal: feet on the pavement, legs straight.
      group.position.y = 0
      group.visible = true
      if (body.current) body.current.position.y = 0
      dropReset.current = false
    }
    // A market visit: on first entering the market frontage while walking the
    // loop, sometimes pop in to browse — same pattern as the pedestrians.
    const inFrontage = group.position.x >= PROMOTER_MARKET_FRONTAGE.fromX && group.position.x <= PROMOTER_MARKET_FRONTAGE.toX
    if (prom.phase === 'walk' && inFrontage && !prom.wasInFrontage && !prom.diverted && Math.random() < PROMOTER_DIVERT_CHANCE) {
      prom.spot = pick(marketSpots)
      prom.path = walkPath([group.position.x, group.position.z], [prom.spot.position[0], prom.spot.position[2]], layout).map(([x, z]) => new THREE.Vector3(x, 0, z))
      prom.phase = 'toMarket'
      prom.diverted = true
    }
    if (!inFrontage) prom.diverted = false
    prom.wasInFrontage = inFrontage
    // Browsing is over: head back out to the sidewalk, then resume the loop.
    if (prom.phase === 'browse' && t >= prom.until) {
      prom.path = walkPath([group.position.x, group.position.z], [MARKET_ENTRY_X, SIDEWALK_Z], layout).map(([x, z]) => new THREE.Vector3(x, 0, z))
      prom.phase = 'toSidewalk'
    }
    const next = prom.path[0]
    let walking = false
    if (next) {
      const toNext = next.clone().sub(group.position)
      const distance = toNext.length()
      if (distance < 0.05) {
        prom.path.shift()
      } else {
        walking = true
        group.position.add(toNext.clone().normalize().multiplyScalar(Math.min(distance, delta * PROMOTER_WALK_SPEED)))
        if (Math.hypot(toNext.x, toNext.z) > 0.01) {
          const heading = Math.atan2(toNext.x, toNext.z)
          group.rotation.y += Math.atan2(Math.sin(heading - group.rotation.y), Math.cos(heading - group.rotation.y)) * 0.25
        }
      }
    }
    if (prom.path.length === 0) {
      if (prom.phase === 'walk') {
        // Reached a loop waypoint: head for the next one.
        prom.loopIndex = (prom.loopIndex + 1) % loop.length
        const [x, z] = loop[prom.loopIndex]
        prom.path = [new THREE.Vector3(x, 0, z)]
      } else if (prom.phase === 'toMarket') {
        prom.phase = 'browse'
        prom.until = t + random(PROMOTER_BROWSE_MIN_S, PROMOTER_BROWSE_MAX_S)
      } else if (prom.phase === 'toSidewalk') {
        prom.phase = 'walk'
        const [x, z] = loop[prom.loopIndex]
        prom.path = [new THREE.Vector3(x, 0, z)]
      }
    }
    if (!walking && prom.phase === 'browse' && prom.spot) {
      group.rotation.y += Math.atan2(Math.sin(prom.spot.facing - group.rotation.y), Math.cos(prom.spot.facing - group.rotation.y)) * 0.12
    }
    const swing = walking ? Math.sin(t * 9) * 0.5 : 0
    if (leftLeg.current && rightLeg.current) {
      leftLeg.current.rotation.x = swing
      rightLeg.current.rotation.x = -swing
    }
    if (leftArm.current && rightArm.current) {
      leftArm.current.rotation.x = walking ? -swing : 0
      rightArm.current.rotation.x = walking ? swing : 0
    }
    if (body.current) body.current.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.03 : 0
    // Where he is, for the UFO (a future victim) and for verification.
    positionRef.current = { x: group.position.x, y: group.position.y, z: group.position.z }
  })

  const start = loop[0]
  return <group ref={root} position={[start[0], 0, start[1]]} rotation={[0, Math.PI / 2, 0]}>
    <group ref={body}>
      <mesh ref={leftLeg} position={[-0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color="#34393f" roughness={0.8}/></mesh>
      <mesh ref={rightLeg} position={[0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color="#34393f" roughness={0.8}/></mesh>
      <RBox position={[0, 0.98, 0]} size={[0.48, 0.58, 0.3]} radius={0.07} color="#d8b36a" roughness={0.85}/>
      <mesh ref={leftArm} position={[-0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color="#d8b36a" roughness={0.85}/></mesh>
      <mesh ref={rightArm} position={[0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color="#d8b36a" roughness={0.85}/></mesh>
      <RBox position={[0, 1.5, 0]} size={[0.4, 0.4, 0.37]} radius={0.08} color="#c98e5a" roughness={0.7}/>
      <RBox position={[0, 1.72, -0.02]} size={[0.43, 0.13, 0.41]} radius={0.05} color="#1f2326" roughness={0.9}/>
      <RBox position={[0, 1.58, -0.19]} size={[0.43, 0.3, 0.06]} radius={0.03} color="#1f2326" roughness={0.9}/>
      <RBox position={[-0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
      <RBox position={[0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
      {/* Promo board, front and back (sandwich style), with shoulder straps. */}
      <RBox position={[0, 1.02, 0.26]} size={[0.84, 0.29, 0.02]} radius={0.02} color="#16283d"/>
      <mesh position={[0, 1.02, 0.275]}><planeGeometry args={[0.8, 0.25]}/><meshStandardMaterial map={board} roughness={0.7}/></mesh>
      <RBox position={[0, 1.02, -0.26]} size={[0.84, 0.29, 0.02]} radius={0.02} color="#16283d"/>
      <mesh position={[0, 1.02, -0.275]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.8, 0.25]}/><meshStandardMaterial map={board} roughness={0.7}/></mesh>
      {[0.15, -0.15].map((x) => <RBox key={x} position={[x, 1.24, 0.24]} size={[0.05, 0.16, 0.02]} radius={0.01} color="#16283d" shadow={false}/>)}
      {[0.15, -0.15].map((x) => <RBox key={x} position={[x, 1.24, -0.24]} size={[0.05, 0.16, 0.02]} radius={0.01} color="#16283d" shadow={false}/>)}
      <object3D ref={registerAnchor('street-ricky')} position={[0, 2.05, 0]}/>
    </group>
  </group>
}
