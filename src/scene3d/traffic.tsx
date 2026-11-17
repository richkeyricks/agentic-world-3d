// Street traffic: a few cars and motorcycles passing on the road in front of the
// office (z 9.6..14.6), both directions, low speed, looping — plus two or three
// motorcycles that sometimes pull over at a food stall to buy food, have a brief
// bubble exchange with the vendor, then ride off. Procedural low-poly vehicles
// only; they stay on the road and the pavement edge and never drive through the
// building, the stalls, the guard post, the signs or Ricky Market (x 18..28).
//
// Vehicles are built facing +x, so a heading is atan2(-dz, dx) — NOT atan2(dx, dz),
// which is the formula for a +z-facing model (the walking agents) and made the
// departing motorcycle face sideways.

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { OfficeLayout } from '../office3d-layout.ts'
import { Cyl, RBox } from './props.tsx'

export type RegisterAnchor = (key: string) => (object: THREE.Object3D | null) => void

/** What the DOM bubbles need to know about a stopped buyer: which bike, where. */
export interface BuyerState { phase: 'stopped'; index: number; stall: string; x: number; z: number }
export interface TrafficState { buyers: BuyerState[] }

const LANE_EAST = 11.0 // eastbound (+x), left-hand traffic: the far lane
const LANE_WEST = 13.2 // westbound (-x): the near lane
const PULL_OVER_Z = 9.4 // pavement edge by the stalls (carts sit at z 8.6)
const STOP_MS = 12_000
const BUYER_GAP_MIN_MS = 25_000
const BUYER_GAP_MAX_MS = 45_000
const BUYER_COUNT = 3

const CAR_COLORS = ['#c62828', '#1565c0', '#e2b33c']
const BIKE_COLOR = '#2e7d32'
const BUYER_COLORS = ['#6a1b9a', '#00796b', '#e65100']
const BUYER_SHIRTS = ['#e2725b', '#f1f1ec', '#2f6d8f']

const random = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/** Heading (rotation.y) for a vehicle built facing +x, travelling in (dx, dz). */
const headingFor = (dx: number, dz: number) => Math.atan2(-dz, dx)

/** A low-poly car, built facing +x (headlights at the +x end). */
function Car({ color, groupRef, wheelRef }: { color: string; groupRef: (group: THREE.Group | null) => void; wheelRef: (index: number) => (group: THREE.Group | null) => void }) {
  return <group ref={groupRef}>
    <RBox position={[0, 0.55, 0]} size={[2.2, 0.55, 1.1]} radius={0.08} color={color} roughness={0.5}/>
    <RBox position={[-0.1, 1.02, 0]} size={[1.2, 0.45, 0.95]} radius={0.06} color="#37474f" roughness={0.2}/>
    <RBox position={[-0.1, 1.28, 0]} size={[1.1, 0.06, 0.9]} radius={0.02} color={color} roughness={0.5}/>
    {[[-0.75, -0.55], [-0.75, 0.55], [0.75, -0.55], [0.75, 0.55]].map(([x, z], index) => <group key={index} ref={wheelRef(index)} position={[x, 0.3, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.12, 16]}/><meshStandardMaterial color="#1f2326" roughness={0.8}/></mesh>
    </group>)}
    {[[-0.35], [0.35]].map(([z]) => <RBox key={`h${z}`} position={[1.12, 0.55, z]} size={[0.04, 0.1, 0.18]} radius={0.01} color="#fff2c4" emissive="#ffedb0" emissiveIntensity={1.5} shadow={false}/>)}
    {[[-0.35], [0.35]].map(([z]) => <RBox key={`t${z}`} position={[-1.12, 0.55, z]} size={[0.04, 0.1, 0.18]} radius={0.01} color="#c62828" emissive="#ff5252" emissiveIntensity={1} shadow={false}/>)}
  </group>
}

/** A low-poly motorcycle with a rider, built facing +x. It reads as a motorcycle,
// not a bicycle: fat tyres, an engine block, a fuel tank, an exhaust pipe, and a
// rider leaning forward over the tank. */
function Motorcycle({ color, shirt, groupRef, wheelRef, riderAnchor }: { color: string; shirt: string; groupRef: (group: THREE.Group | null) => void; wheelRef: (index: number) => (group: THREE.Group | null) => void; riderAnchor?: (object: THREE.Object3D | null) => void }) {
  return <group ref={groupRef}>
    {[[-0.55], [0.55]].map(([x], index) => <group key={index} ref={wheelRef(index)} position={[x, 0.39, 0]}>
      <mesh castShadow><torusGeometry args={[0.3, 0.09, 10, 22]}/><meshStandardMaterial color="#1f2326" roughness={0.85}/></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.1, 12]}/><meshStandardMaterial color="#8b9297" metalness={0.7} roughness={0.3}/></mesh>
      <mesh><boxGeometry args={[0.52, 0.05, 0.05]}/><meshStandardMaterial color="#8b9297" metalness={0.6}/></mesh>
    </group>)}
    {/* Engine block + exhaust — the parts a bicycle does not have */}
    <RBox position={[0, 0.34, 0]} size={[0.55, 0.34, 0.34]} radius={0.06} color="#3a4046" metalness={0.6} roughness={0.4}/>
    <Cyl position={[0.05, 0.2, 0.18]} radius={0.05} height={0.75} rotation={[0, 0, Math.PI / 2]} color="#b9c0c4" metalness={0.75} roughness={0.25}/>
    {/* Fuel tank + seat */}
    <RBox position={[0.08, 0.62, 0]} size={[0.5, 0.22, 0.3]} radius={0.09} color={color} roughness={0.4}/>
    <RBox position={[-0.28, 0.66, 0]} size={[0.5, 0.1, 0.26]} radius={0.03} color="#1f2326"/>
    {/* Front fork + handlebar + headlight */}
    <RBox position={[0.53, 0.56, 0]} size={[0.06, 0.62, 0.06]} radius={0.02} color="#2a2f33" rotation={[0, 0, -0.08]}/>
    <RBox position={[0.5, 0.88, 0]} size={[0.06, 0.06, 0.5]} radius={0.02} color="#2a2f33"/>
    <RBox position={[0.48, 0.64, 0]} size={[0.05, 0.25, 0.05]} radius={0.01} color="#2a2f33"/>
    <RBox position={[0.64, 0.62, 0]} size={[0.05, 0.12, 0.18]} radius={0.01} color="#fff2c4" emissive="#ffedb0" emissiveIntensity={1.5} shadow={false}/>
    {/* Rider, leaning slightly forward over the tank */}
    <RBox position={[0, 1.05, 0]} size={[0.36, 0.5, 0.26]} radius={0.07} color={shirt} roughness={0.85} rotation={[0, 0, -0.12]}/>
    <RBox position={[0.02, 1.42, 0]} size={[0.3, 0.3, 0.28]} radius={0.08} color="#c98e5a" roughness={0.7} rotation={[0, 0, -0.12]}/>
    <RBox position={[0.03, 1.5, 0]} size={[0.36, 0.18, 0.34]} radius={0.06} color={color} roughness={0.5} rotation={[0, 0, -0.12]}/>
    <RBox position={[0.28, 0.95, 0.12]} size={[0.1, 0.4, 0.1]} radius={0.04} rotation={[-0.7, 0, 0]} color={shirt}/>
    <RBox position={[0.28, 0.95, -0.12]} size={[0.1, 0.4, 0.1]} radius={0.04} rotation={[-0.7, 0, 0]} color={shirt}/>
    <RBox position={[0.1, 0.72, 0.14]} size={[0.12, 0.4, 0.12]} radius={0.04} rotation={[0.5, 0, 0]} color="#34393f"/>
    <RBox position={[0.1, 0.72, -0.14]} size={[0.12, 0.4, 0.12]} radius={0.04} rotation={[0.5, 0, 0]} color="#34393f"/>
    {riderAnchor && <object3D ref={riderAnchor} position={[0, 1.95, 0]}/>}
  </group>
}

interface Cruiser { kind: 'car' | 'bike'; dir: 1 | -1; lane: number; x: number; speed: number; active: boolean; resumeAt: number }
interface Buyer { phase: 'hidden' | 'cruise' | 'pullover' | 'stopped' | 'leave'; x: number; z: number; stall: string; stallX: number; until: number; speed: number }

const FRONT_STALLS = ['cilok', 'nasgor', 'penyet'] as const

export function StreetTraffic({ layout, registerAnchor, trafficRef }: { layout: OfficeLayout; registerAnchor: RegisterAnchor; trafficRef: { current: TrafficState } }) {
  // The road plane spans x (shift - 30)..30; vehicles spawn just past either end.
  const westEnd = layout.building.minX + 9.5 - 32
  const eastEnd = 32
  const stallX = (stall: string) => stall === 'cilok' ? layout.cilokCart[0] : stall === 'nasgor' ? layout.nasgorCart[0] : layout.penyetCart[0]
  const groups = useRef<(THREE.Group | null)[]>([])
  const wheels = useRef<(THREE.Group | null)[]>([])
  const cruisers = useRef<Cruiser[]>([
    { kind: 'car', dir: 1, lane: LANE_EAST, x: westEnd, speed: 2.6, active: false, resumeAt: 2 },
    { kind: 'car', dir: -1, lane: LANE_WEST, x: eastEnd, speed: 3.0, active: false, resumeAt: 7 },
    { kind: 'bike', dir: 1, lane: LANE_EAST, x: westEnd, speed: 3.8, active: false, resumeAt: 12 },
  ])
  const buyers = useRef<Buyer[]>(Array.from({ length: BUYER_COUNT }, (_, index) => ({
    phase: 'hidden' as const,
    x: westEnd,
    z: LANE_EAST,
    stall: FRONT_STALLS[index % FRONT_STALLS.length],
    stallX: stallX(FRONT_STALLS[index % FRONT_STALLS.length]),
    until: 8 + index * 20,
    speed: 3.6 + index * 0.3,
  })))

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const step = Math.min(delta, 0.05)
    const move = (group: THREE.Group | null, x: number, z: number, heading: number, speed: number, wheelCount: number, wheelBase: number, wheelRadius: number, dir: number) => {
      if (!group) return
      group.visible = true
      group.position.set(x, 0, z)
      const turn = Math.atan2(Math.sin(heading - group.rotation.y), Math.cos(heading - group.rotation.y))
      group.rotation.y += turn * Math.min(1, step * 8)
      for (let index = 0; index < wheelCount; index += 1) {
        const wheel = wheels.current[wheelBase + index]
        if (wheel) wheel.rotation.z -= (dir * speed * step) / wheelRadius
      }
    }
    cruisers.current.forEach((cruiser, index) => {
      const group = groups.current[index]
      if (!cruiser.active) {
        if (group) group.visible = false
        if (t < cruiser.resumeAt) return
        cruiser.active = true
        cruiser.x = cruiser.dir > 0 ? westEnd : eastEnd
        cruiser.speed = random(2.2, 3.6)
        return
      }
      cruiser.x += cruiser.dir * cruiser.speed * step
      if (cruiser.x > eastEnd + 2 || cruiser.x < westEnd - 2) {
        cruiser.active = false
        cruiser.resumeAt = t + random(4, 12)
        if (group) group.visible = false
        return
      }
      const wheelBase = index === 0 ? 0 : index === 1 ? 4 : 8
      const wheelCount = cruiser.kind === 'car' ? 4 : 2
      const wheelRadius = cruiser.kind === 'car' ? 0.3 : 0.39
      move(group, cruiser.x, cruiser.lane, headingFor(cruiser.dir, 0), cruiser.speed, wheelCount, wheelBase, wheelRadius, cruiser.dir)
    })
    buyers.current.forEach((bike, index) => {
      const bikeGroup = groups.current[3 + index]
      const wheelBase = 10 + index * 2
      if (bike.phase === 'hidden') {
        if (bikeGroup) bikeGroup.visible = false
        if (t >= bike.until) {
          bike.stall = pick(FRONT_STALLS)
          bike.stallX = stallX(bike.stall)
          bike.x = westEnd
          bike.z = LANE_EAST
          bike.phase = 'cruise'
        }
        return
      }
      if (bike.phase === 'cruise') {
        bike.x += bike.speed * step
        move(bikeGroup, bike.x, bike.z, headingFor(1, 0), bike.speed, 2, wheelBase, 0.39, 1)
        if (bike.x >= bike.stallX - 5) bike.phase = 'pullover'
        return
      }
      if (bike.phase === 'pullover') {
        const targetX = bike.stallX + 0.3
        const dx = targetX - bike.x
        const dz = PULL_OVER_Z - bike.z
        const distance = Math.hypot(dx, dz)
        const speed = 2.2
        if (distance < 0.15) {
          bike.x = targetX
          bike.z = PULL_OVER_Z
          bike.phase = 'stopped'
          bike.until = t + STOP_MS / 1000
          return
        }
        bike.x += (dx / distance) * speed * step
        bike.z += (dz / distance) * speed * step
        move(bikeGroup, bike.x, bike.z, headingFor(dx, dz), speed, 2, wheelBase, 0.39, 1)
        return
      }
      if (bike.phase === 'stopped') {
        // Facing the cart (-z) while ordering.
        move(bikeGroup, bike.x, bike.z, headingFor(0, -1), 0, 2, wheelBase, 0.39, 1)
        if (t >= bike.until) bike.phase = 'leave'
        return
      }
      // Leave: swing back out to the eastbound lane and ride off, nose first.
      const dx = 4
      const dz = LANE_EAST - bike.z
      const distance = Math.hypot(dx, dz)
      const speed = 3
      bike.x += (dx / distance) * speed * step
      bike.z += (dz / distance) * speed * step
      move(bikeGroup, bike.x, bike.z, headingFor(dx, dz), speed, 2, wheelBase, 0.39, 1)
      if (bike.x > eastEnd + 2) {
        bike.phase = 'hidden'
        bike.until = t + random(BUYER_GAP_MIN_MS, BUYER_GAP_MAX_MS) / 1000
        if (bikeGroup) bikeGroup.visible = false
      }
    })
    // Stopped buyers, for the DOM bubbles (bike index included so each label pairs
    // with its own bike's anchor).
    trafficRef.current.buyers = buyers.current
      .map((bike, index) => ({ bike, index }))
      .filter(({ bike }) => bike.phase === 'stopped')
      .map(({ bike, index }) => ({ phase: 'stopped' as const, index, stall: bike.stall, x: bike.x, z: bike.z }))
  })

  const wheelRef = (base: number) => (index: number) => (group: THREE.Group | null) => { wheels.current[base + index] = group }
  return <>
    <Car color={CAR_COLORS[0]} groupRef={(group) => { groups.current[0] = group }} wheelRef={wheelRef(0)}/>
    <Car color={CAR_COLORS[1]} groupRef={(group) => { groups.current[1] = group }} wheelRef={wheelRef(4)}/>
    <Motorcycle color={BIKE_COLOR} shirt="#f1f1ec" groupRef={(group) => { groups.current[2] = group }} wheelRef={wheelRef(8)}/>
    {buyers.current.map((_, index) => <Motorcycle key={index} color={BUYER_COLORS[index]} shirt={BUYER_SHIRTS[index]} groupRef={(group) => { groups.current[3 + index] = group }} wheelRef={wheelRef(10 + index * 2)} riderAnchor={registerAnchor(`street-rider-${index}`)}/>)}
  </>
}
