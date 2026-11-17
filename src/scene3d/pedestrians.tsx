// Pedestrians on the sidewalk: a few low-poly figures strolling past the office, some
// of whom pop into Ricky Market to browse and come back out. Real walking figures (not
// static props) — they are also the UFO abduction victims. They reuse the office
// pathfinding (walkPath) for the market detour, and walk the sidewalk lanes directly:
// eastbound z 5.9, westbound z 7.0, clear of the guard post (base to z 5.65), the
// busker (z 6.2), the carts (z 8.6) and the trees. They never block the market
// entrance, the stalls or the road. Movement follows the agents' pattern (unclamped
// delta, leg swing, facing the direction of travel).
//
// When the UFO takes one of them, they stop walking on the spot (frozen under
// the beam), rise up the beam (lift), vanish inside the ship (carried), and
// come back down at a different place (drop) — then resume strolling from
// there, as if nothing happened.

import { useFrame } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { MARKET_ENTRY_X, SIDEWALK_Z, walkPath, type OfficeLayout, type Placement } from '../office3d-layout.ts'
import { RBox } from './props.tsx'
import type { UfoAbduction, UfoVictimId } from './ufo-state.ts'

export interface PedestrianPosition { x: number; z: number }

const PEDESTRIAN_COUNT = 3
const WALK_SPEED = 1.2
const LANE_EAST = 5.9
const LANE_WEST = 7.0
const WEST_END = -13
const EAST_END = 27
const MARKET_FRONTAGE = { fromX: 18, toX: 26 }
const DIVERT_CHANCE = 0.35
const BROWSE_MIN_S = 10
const BROWSE_MAX_S = 20

const SHIRTS = ['#c62828', '#1565c0', '#e2b33c']
const PANTS = ['#34393f', '#4a3f35', '#2f4a3a']
const SKINS = ['#c98e5a', '#8d5a3b', '#e0ac69']
const HAIRS = ['#1f2326', '#4a3226', '#6b6b6b']

const random = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

// Legs and arms pivot at the hip / shoulder: translate the geometry so its top sits at the origin.
const legGeometry = new THREE.BoxGeometry(0.17, 0.62, 0.2).translate(0, -0.31, 0)
const armGeometry = new THREE.BoxGeometry(0.12, 0.52, 0.14).translate(0, -0.26, 0)

type PedPhase = 'stroll' | 'toMarket' | 'browse' | 'toSidewalk'

interface PedState {
  phase: PedPhase
  path: THREE.Vector3[]
  dir: 1 | -1
  diverted: boolean
  wasInFrontage: boolean
  spot: Placement | null
  until: number
}

function Pedestrian({ index, layout, start, positionsRef, abductionRef }: { index: number; layout: OfficeLayout; start: { x: number; dir: 1 | -1 }; positionsRef: MutableRefObject<(PedestrianPosition | null)[]>; abductionRef: MutableRefObject<UfoAbduction | null> }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Mesh>(null)
  const rightArm = useRef<THREE.Mesh>(null)
  const marketSpots = layout.idleStops.find((item) => item.key === 'market')!.spots
  const state = useRef<PedState>({ phase: 'stroll', path: [], dir: start.dir, diverted: false, wasInFrontage: false, spot: null, until: 0 })
  const myId = `ped-${index}` as UfoVictimId
  /** True once the drop-off reset ran, so it runs once per abduction. */
  const dropReset = useRef(false)
  const lane = (dir: 1 | -1) => dir > 0 ? LANE_EAST : LANE_WEST
  const strollTarget = (dir: 1 | -1) => new THREE.Vector3(dir > 0 ? EAST_END : WEST_END, 0, lane(dir))

  useFrame(({ clock }, delta) => {
    const group = root.current
    if (!group) return
    const t = clock.elapsedTime
    const ped = state.current
    // Abducted: the UFO owns the body now — freeze under the beam, rise up it,
    // hide inside the ship, come back down somewhere else, then stroll on.
    const abduction = abductionRef.current
    if (abduction?.victim === myId) {
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
          // Dropped somewhere else: forget the old stroll and start fresh here.
          ped.phase = 'stroll'
          ped.path = []
          ped.diverted = false
          ped.spot = null
          dropReset.current = true
        }
        group.visible = true
        group.position.set(abduction.dropX, abduction.liftY, abduction.dropZ)
      }
      positionsRef.current[index] = { x: group.position.x, z: group.position.z }
      return
    }
    if (dropReset.current) {
      // Back on the ground, back to normal: feet on the pavement, legs straight.
      group.position.y = 0
      group.visible = true
      if (body.current) body.current.position.y = 0
      dropReset.current = false
    }
    if (ped.phase === 'stroll' && ped.path.length === 0) ped.path = [strollTarget(ped.dir)]
    // A market visit: on first entering the market frontage while strolling, sometimes pop in.
    const inFrontage = group.position.x >= MARKET_FRONTAGE.fromX && group.position.x <= MARKET_FRONTAGE.toX
    if (ped.phase === 'stroll' && inFrontage && !ped.wasInFrontage && !ped.diverted && Math.random() < DIVERT_CHANCE) {
      ped.spot = pick(marketSpots)
      ped.path = walkPath([group.position.x, group.position.z], [ped.spot.position[0], ped.spot.position[2]], layout).map(([x, z]) => new THREE.Vector3(x, 0, z))
      ped.phase = 'toMarket'
      ped.diverted = true
    }
    if (!inFrontage) ped.diverted = false
    ped.wasInFrontage = inFrontage
    // Browsing is over: head back out to the sidewalk.
    if (ped.phase === 'browse' && t >= ped.until) {
      ped.path = walkPath([group.position.x, group.position.z], [MARKET_ENTRY_X, SIDEWALK_Z], layout).map(([x, z]) => new THREE.Vector3(x, 0, z))
      ped.phase = 'toSidewalk'
    }
    const next = ped.path[0]
    let walking = false
    if (next) {
      const toNext = next.clone().sub(group.position)
      const distance = toNext.length()
      if (distance < 0.05) {
        ped.path.shift()
      } else {
        walking = true
        group.position.add(toNext.clone().normalize().multiplyScalar(Math.min(distance, delta * WALK_SPEED)))
        if (Math.hypot(toNext.x, toNext.z) > 0.01) {
          const heading = Math.atan2(toNext.x, toNext.z)
          group.rotation.y += Math.atan2(Math.sin(heading - group.rotation.y), Math.cos(heading - group.rotation.y)) * 0.25
        }
      }
    }
    if (ped.path.length === 0) {
      if (ped.phase === 'stroll') {
        // Reached the end of the sidewalk: turn around and walk back.
        ped.dir = (ped.dir * -1) as 1 | -1
        ped.path = [strollTarget(ped.dir)]
      } else if (ped.phase === 'toMarket') {
        ped.phase = 'browse'
        ped.until = t + random(BROWSE_MIN_S, BROWSE_MAX_S)
      } else if (ped.phase === 'toSidewalk') {
        ped.phase = 'stroll'
        ped.path = [strollTarget(ped.dir)]
      }
    }
    if (!walking && ped.phase === 'browse' && ped.spot) {
      group.rotation.y += Math.atan2(Math.sin(ped.spot.facing - group.rotation.y), Math.cos(ped.spot.facing - group.rotation.y)) * 0.12
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
    // Where they are, for the UFO (a possible victim) and for verification.
    positionsRef.current[index] = { x: group.position.x, z: group.position.z }
  })

  return <group ref={root} position={[start.x, 0, lane(start.dir)]} rotation={[0, start.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
    <group ref={body}>
      <mesh ref={leftLeg} position={[-0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={PANTS[index % PANTS.length]} roughness={0.8}/></mesh>
      <mesh ref={rightLeg} position={[0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={PANTS[index % PANTS.length]} roughness={0.8}/></mesh>
      <RBox position={[0, 0.98, 0]} size={[0.48, 0.58, 0.3]} radius={0.07} color={SHIRTS[index % SHIRTS.length]} roughness={0.85}/>
      <mesh ref={leftArm} position={[-0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={SHIRTS[index % SHIRTS.length]} roughness={0.85}/></mesh>
      <mesh ref={rightArm} position={[0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={SHIRTS[index % SHIRTS.length]} roughness={0.85}/></mesh>
      <RBox position={[0, 1.5, 0]} size={[0.4, 0.4, 0.37]} radius={0.08} color={SKINS[index % SKINS.length]} roughness={0.7}/>
      <RBox position={[0, 1.72, -0.02]} size={[0.43, 0.13, 0.41]} radius={0.05} color={HAIRS[index % HAIRS.length]} roughness={0.9}/>
      <RBox position={[0, 1.58, -0.19]} size={[0.43, 0.3, 0.06]} radius={0.03} color={HAIRS[index % HAIRS.length]} roughness={0.9}/>
      <RBox position={[-0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
      <RBox position={[0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
    </group>
  </group>
}

export function Pedestrians({ layout, positionsRef, abductionRef }: { layout: OfficeLayout; positionsRef: MutableRefObject<(PedestrianPosition | null)[]>; abductionRef: MutableRefObject<UfoAbduction | null> }) {
  return <>
    {Array.from({ length: PEDESTRIAN_COUNT }, (_, index) => {
      const starts = [{ x: -8, dir: 1 as const }, { x: 6, dir: -1 as const }, { x: 18, dir: 1 as const }]
      return <Pedestrian key={index} index={index} layout={layout} start={starts[index]} positionsRef={positionsRef} abductionRef={abductionRef}/>
    })}
  </>
}
