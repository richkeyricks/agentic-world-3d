// The UFO + alien abduction event: a flying saucer occasionally appears, hovers
// over the street, drops a light beam, sends a little green alien down, lifts a
// pedestrian (or Ricky the promoter) up into the ship, flies off — and comes
// back to drop them at a DIFFERENT place, like in the movies. Procedural
// low-poly only (disc, dome, rim lights, beam cone, ground glow, one alien),
// no new assets, a handful of meshes. The event is driven by the pure state
// machine in ufo-state.ts; this component only renders it and writes the
// shared abduction ref the walkers read (they freeze, rise, hide, and resume
// from the drop point on their own). Camera only in the sense that it never
// touches the camera — POV mode and the orbit controls are unaffected.

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { OfficeLayout } from '../office3d-layout.ts'
import { promoterLoop } from './promoter-route.ts'
import { nightAmount } from './day-night.tsx'
import type { RegisterAnchor } from './traffic.tsx'
import { RBox } from './props.tsx'
import {
  UFO_BEAM,
  UFO_BEAM_TOP_Y,
  UFO_HOVER_Y,
  abductionFor,
  alienY,
  beamOpacityScale,
  createUfoState,
  isIndoors,
  pickDropPoint,
  stepUfo,
  ufoBeam,
  ufoPosition,
  victimLiftY,
  type UfoAbduction,
  type UfoPhase,
  type UfoState,
  type UfoVictimId,
} from './ufo-state.ts'
import type { PedestrianPosition } from './pedestrians.tsx'
import type { PromoterPosition } from './promoter.tsx'

export interface UfoStatus {
  phase: UfoPhase
  victim: UfoVictimId | null
  /** The victim of the current (or just finished) event. */
  lastVictim: UfoVictimId | null
  liftY: number
  /** Phases visited in the current (or just finished) event, in order. */
  history: UfoPhase[]
  /** Highest the victim was lifted in the current event. */
  maxLiftY: number
  /** Where the victim was taken from (hover when the beam locked on). */
  abductAt: { x: number; z: number } | null
  /** Where the victim is dropped off. */
  dropAt: { x: number; z: number } | null
}

/** Rim lights around the saucer, cycling through four colours. */
const RIM_COLORS = ['#ff5a5a', '#ffd23e', '#5aff8a', '#5aa8ff']
const RIM_COUNT = 8

export function Ufo({ layout, registerAnchor, pedPositions, promoterPosition, abductionRef, statusRef, firstIn, forcedVictim, holdBeam, holdLift }: {
  layout: OfficeLayout
  registerAnchor: RegisterAnchor
  pedPositions: MutableRefObject<(PedestrianPosition | null)[]>
  promoterPosition: MutableRefObject<PromoterPosition | null>
  abductionRef: MutableRefObject<UfoAbduction | null>
  statusRef: MutableRefObject<UfoStatus>
  /** Verification hook: start the first event this many seconds after load. */
  firstIn?: number
  /** Verification hook: force this victim for the next event. */
  forcedVictim?: UfoVictimId | null
  /** Verification hook: freeze the event in the beam phase (for screenshots). */
  holdBeam?: boolean
  /** Verification hook: freeze the event once the victim is halfway up the beam. */
  holdLift?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const rimRef = useRef<THREE.Group>(null)
  const beamMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const beamMesh = useRef<THREE.Mesh>(null)
  const beamCoreMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const beamCoreMesh = useRef<THREE.Mesh>(null)
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const glowMesh = useRef<THREE.Mesh>(null)
  const alienRef = useRef<THREE.Group>(null)
  const loop = useMemo(() => promoterLoop(layout), [layout])
  const stateRef = useRef<UfoState | null>(null)
  /** Highest lift sampled in the current event (reset when a new event starts).
      The lift sits at the belly for the whole carry + return, so sampling
      catches it even at low frame rates. */
  const maxLiftRef = useRef(0)
  const prevPhaseRef = useRef<UfoPhase>('idle')

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (!stateRef.current) stateRef.current = createUfoState(t, firstIn)
    // Who can be taken right now: the pedestrians and Ricky, but only while
    // they are out on the street — no beam goes through a roof.
    const candidates: { id: UfoVictimId; x: number; z: number }[] = []
    pedPositions.current.forEach((position, index) => {
      if (position && !isIndoors(position.x, position.z, layout)) candidates.push({ id: `ped-${index}` as UfoVictimId, x: position.x, z: position.z })
    })
    const prom = promoterPosition.current
    if (prom && !isIndoors(prom.x, prom.z, layout)) candidates.push({ id: 'ricky', x: prom.x, z: prom.z })
    // The holds (verification only) live in the machine: it freezes in the
    // beam, or halfway up the lift, even when a slow frame jumps two phases.
    stateRef.current = stepUfo(stateRef.current, t, {
      candidates,
      forcedVictim: forcedVictim ?? null,
      pickDrop: (victim, at) => pickDropPoint(victim, at, loop),
      holdBeam: holdBeam ?? false,
      holdLift: holdLift ?? false,
    })
    const state = stateRef.current
    // While a lift hold is in progress the derived values (lift, alien height,
    // beam) are computed from the frozen time, so the victim stays mid-beam.
    const tt = state.liftFrozenAt ?? t
    const position = ufoPosition(state, tt)
    const g = group.current
    if (!g) return
    g.visible = position !== null
    if (position) g.position.set(position.x, position.y + Math.sin(tt * 1.2) * 0.15, position.z)
    // The rim lights orbit the saucer — the classic blinking ring.
    if (rimRef.current) rimRef.current.rotation.y += delta * 0.8
    const beam = ufoBeam(state, tt)
    // In daylight the bright sky washes a translucent beam out, so the beam
    // renders stronger when the sun is up (night keeps the palette values).
    const beamScale = beamOpacityScale(nightAmount.current)
    if (beamMesh.current) beamMesh.current.visible = beam.visible
    if (beamMaterial.current) beamMaterial.current.opacity = beam.visible ? Math.min(0.85, UFO_BEAM.outerOpacity * beamScale * beam.opacity) : 0
    if (beamCoreMesh.current) beamCoreMesh.current.visible = beam.visible
    if (beamCoreMaterial.current) beamCoreMaterial.current.opacity = beam.visible ? Math.min(0.85, UFO_BEAM.coreOpacity * beamScale * beam.opacity) : 0
    if (glowMesh.current) glowMesh.current.visible = beam.visible
    if (glowMaterial.current) glowMaterial.current.opacity = beam.visible ? Math.min(0.85, UFO_BEAM.glowOpacity * beamScale * beam.opacity) : 0
    // The alien rides the beam: down to the victim, up with them, back down
    // for the drop-off, then hurries back up while the victim stays behind.
    const ay = alienY(state, tt)
    if (alienRef.current) {
      alienRef.current.visible = ay !== null
      if (ay !== null) alienRef.current.position.set(0.7, ay - g.position.y, 0.3)
    }
    const lift = victimLiftY(state, tt)
    const abduction = abductionFor(state)
    abductionRef.current = abduction
      ? { victim: abduction.victim, phase: abduction.phase, liftY: lift ?? 0, dropX: state.drop?.x ?? 0, dropZ: state.drop?.z ?? 0 }
      : null
    // The record of the event, for the label's data attributes: the phases and
    // the abduction point come from the machine itself (complete even when a
    // slow frame spans two phases). The highest lift is sampled here — and, if
    // the machine visited the carry, the victim was at the belly by definition
    // (victimLiftY is the belly height for the whole carry + return), so a
    // slow frame that never sampled it does not under-report the lift.
    if (state.phase === 'arrive' && prevPhaseRef.current === 'idle') maxLiftRef.current = 0
    prevPhaseRef.current = state.phase
    if (lift !== null) maxLiftRef.current = Math.max(maxLiftRef.current, lift)
    const maxLiftY = Math.max(maxLiftRef.current, state.history.includes('carry') || state.history.includes('return') ? UFO_BEAM_TOP_Y : 0)
    statusRef.current = { phase: state.phase, victim: state.victim, lastVictim: state.lastVictim, liftY: lift ?? 0, history: state.history, maxLiftY, abductAt: state.abductAt, dropAt: state.lastDrop }
  })

  return <group ref={group} visible={false}>
    {/* Saucer: metal disc, glass dome, glowing belly, ring of lights. */}
    <mesh castShadow><cylinderGeometry args={[2.3, 1.6, 0.6, 24]}/><meshStandardMaterial color="#8a94a6" metalness={0.7} roughness={0.35}/></mesh>
    <mesh position={[0, 0.45, 0]}><sphereGeometry args={[1.15, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color="#9fd8ff" transparent opacity={0.55} metalness={0.1} roughness={0.1}/></mesh>
    <mesh position={[0, -0.42, 0]} scale={[1, 0.45, 1]}><sphereGeometry args={[0.8, 20, 12]}/><meshStandardMaterial color="#2a2f2a" emissive="#7dff6a" emissiveIntensity={1.2} roughness={0.6}/></mesh>
    <group ref={rimRef}>
      {Array.from({ length: RIM_COUNT }, (_, i) => {
        const angle = (i / RIM_COUNT) * Math.PI * 2
        return <mesh key={i} position={[Math.cos(angle) * 2.0, 0, Math.sin(angle) * 2.0]}>
          <sphereGeometry args={[0.13, 10, 8]}/><meshBasicMaterial color={RIM_COLORS[i % RIM_COLORS.length]}/>
        </mesh>
      })}
    </group>
    {/* The beam: a blue cone from the belly to the ground, a brighter core
        inside it so it reads in daylight, plus the glow where it lands. */}
    <mesh ref={beamMesh} position={[0, -UFO_HOVER_Y / 2, 0]} visible={false}>
      <cylinderGeometry args={[0.5, 2.2, UFO_HOVER_Y, 24, 1, true]}/>
      <meshBasicMaterial ref={beamMaterial} color={UFO_BEAM.outer} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <mesh ref={beamCoreMesh} position={[0, -UFO_HOVER_Y / 2, 0]} visible={false}>
      <cylinderGeometry args={[0.22, 1.1, UFO_HOVER_Y, 20, 1, true]}/>
      <meshBasicMaterial ref={beamCoreMaterial} color={UFO_BEAM.core} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <mesh ref={glowMesh} position={[0, -UFO_HOVER_Y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <circleGeometry args={[2.2, 24]}/>
      <meshBasicMaterial ref={glowMaterial} color={UFO_BEAM.glow} transparent opacity={0} depthWrite={false}/>
    </mesh>
    {/* The alien: little green figure, big eyes, antennae, arms raised in the beam. */}
    <group ref={alienRef} visible={false}>
      <mesh position={[-0.08, 0.13, 0]}><boxGeometry args={[0.1, 0.26, 0.12]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <mesh position={[0.08, 0.13, 0]}><boxGeometry args={[0.1, 0.26, 0.12]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <RBox position={[0, 0.5, 0]} size={[0.36, 0.46, 0.24]} radius={0.06} color="#7ec850" roughness={0.7}/>
      <mesh position={[-0.24, 0.62, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.09, 0.4, 0.1]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <mesh position={[0.24, 0.62, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.09, 0.4, 0.1]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <mesh position={[0, 0.98, 0]}><sphereGeometry args={[0.27, 18, 14]}/><meshStandardMaterial color="#7ec850" roughness={0.6}/></mesh>
      <mesh position={[-0.1, 1.0, 0.22]} rotation={[0.2, -0.25, 0]}><sphereGeometry args={[0.09, 10, 8]}/><meshStandardMaterial color="#101010" roughness={0.3}/></mesh>
      <mesh position={[0.1, 1.0, 0.22]} rotation={[0.2, 0.25, 0]}><sphereGeometry args={[0.09, 10, 8]}/><meshStandardMaterial color="#101010" roughness={0.3}/></mesh>
      <mesh position={[-0.09, 1.28, 0]} rotation={[0, 0, 0.25]}><cylinderGeometry args={[0.015, 0.015, 0.22, 6]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <mesh position={[0.09, 1.28, 0]} rotation={[0, 0, -0.25]}><cylinderGeometry args={[0.015, 0.015, 0.22, 6]}/><meshStandardMaterial color="#7ec850" roughness={0.7}/></mesh>
      <mesh position={[-0.145, 1.4, 0]}><sphereGeometry args={[0.04, 8, 6]}/><meshBasicMaterial color="#ffd23e"/></mesh>
      <mesh position={[0.145, 1.4, 0]}><sphereGeometry args={[0.04, 8, 6]}/><meshBasicMaterial color="#ffd23e"/></mesh>
    </group>
    <object3D ref={registerAnchor('ufo')} position={[0, 1.5, 0]}/>
  </group>
}
