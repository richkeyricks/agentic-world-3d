import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { povEyeHeight, povView, rotateOffsetY, wrapAngleDelta } from '../camera-math.ts'
import { CAMERA_PRESETS, INTRO_DURATION_MS, PRESET_FLIGHT_MS, easeInOutCubic, introSeen, introStartView, markIntroSeen } from '../camera-presets.ts'
import { officeStateBadge } from '../office-state.ts'
import { agentLook } from '../agents.ts'
import { TaskProgressBar } from '../ui.tsx'
import { clampTarget, createLayout, FLOOR_HEIGHT, floorOf, GAME_ROOM, idlePlan, placementFor, walkPath3, type Floor, type OfficeLayout, type Placement, type Vec3 } from '../office3d-layout.ts'
import { Environment } from '../scene3d/environment.tsx'
import { DAY_NIGHT, easeNightAmount, lerpHex, mix, nightAmount } from '../scene3d/day-night.tsx'
import { SkyDome } from '../scene3d/sky.tsx'
import { AmbientParticles } from '../scene3d/particles.tsx'
import { RBox, WorkDesk } from '../scene3d/props.tsx'
import { StreetTraffic, type TrafficState } from '../scene3d/traffic.tsx'
import { Pedestrians, type PedestrianPosition } from '../scene3d/pedestrians.tsx'
import { PromoterRicky, type PromoterPosition } from '../scene3d/promoter.tsx'
import { Ufo, type UfoStatus } from '../scene3d/ufo.tsx'
import { UFO_LINES, type UfoAbduction, type UfoVictimId } from '../scene3d/ufo-state.ts'
import { exchangeFor, exchangeLines, FOOD_STALLS, inExchangeWindow, promoterLine, STREET_KEYS, STREET_NAMES, STREET_PRODUCT, streetLine, type FoodStall, type StreetKey } from '../street-life.ts'
import { meetingLine, meetingSubject } from '../meeting-dialogue.ts'
import type { OfficeStation } from '../types.ts'

// 3D view of the same Office snapshot the 2D view renders. Positions come from each station's
// room, roomPosition and seat, so the 3D office shows exactly the states the server derived.

type Registry<T> = MutableRefObject<Map<string, T>>

/** Ground-floor spots outside the building (gang, sidewalk, yard) stay in view from lantai 2. */
function outdoors(x: number, z: number, layout: OfficeLayout): boolean {
  const { minX, maxX, maxZ } = layout.building
  const inGameRoom = x > GAME_ROOM.minX && x < GAME_ROOM.maxX && z > GAME_ROOM.minZ && z < GAME_ROOM.maxZ
  return x < minX || z > maxZ || (x > maxX && !inGameRoom)
}

function Character({ station, placement, layout, floor, onSelect, anchor, groupRef, hidden }: { station: OfficeStation; placement: Placement; layout: OfficeLayout; floor: Floor; onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void; anchor: (object: THREE.Object3D | null) => void; groupRef: (group: THREE.Group | null) => void; hidden?: boolean }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Mesh>(null)
  const rightArm = useRef<THREE.Mesh>(null)
  const colors = agentLook(station.id)
  const offline = station.state === 'Offline'
  const unknown = station.state === 'Unknown'
  const tint = (color: string) => offline ? '#7b7f7d' : color
  // Only the first placement is applied as a prop; later changes are walked to via the aisle.
  const [start] = useState<Vec3>(() => placement.position)
  const path = useRef<THREE.Vector3[]>([])
  const destination = placement.position.join(',')
  useEffect(() => {
    const group = root.current
    if (!group) return
    path.current = walkPath3([group.position.x, group.position.y, group.position.z], placement.position, layout).map(([px, py, pz]) => new THREE.Vector3(px, py, pz))
    // placement.position is captured through `destination`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination])

  useFrame((state, delta) => {
    const group = root.current
    if (!group) return
    const time = state.clock.elapsedTime
    const next = path.current[0]
    let walking = false
    if (next) {
      const toNext = next.clone().sub(group.position)
      const distance = toNext.length()
      if (distance < 0.04) {
        path.current.shift()
      } else {
        walking = true
        group.position.add(toNext.clone().normalize().multiplyScalar(Math.min(distance, delta * 2.6)))
        if (Math.hypot(toNext.x, toNext.z) > 0.01) {
          const heading = Math.atan2(toNext.x, toNext.z)
          group.rotation.y += Math.atan2(Math.sin(heading - group.rotation.y), Math.cos(heading - group.rotation.y)) * 0.25
        }
      }
    }
    // Only the floor in view is drawn; from lantai 2 the agents outside on the ground stay visible.
    // In POV the agent's own body is hidden — the camera sits at their eyes,
    // so the head would fill the frame, and their label would float mid-screen.
    const upstairs = group.position.y > FLOOR_HEIGHT / 2
    group.visible = hidden ? false : floor === 2 ? upstairs || outdoors(group.position.x, group.position.z, layout) : !upstairs
    if (!walking) group.rotation.y += Math.atan2(Math.sin(placement.facing - group.rotation.y), Math.cos(placement.facing - group.rotation.y)) * 0.12
    const swing = walking ? Math.sin(time * 10) * 0.6 : 0
    const arrived = !walking && path.current.length === 0
    const lying = arrived && placement.pose === 'lie'
    const onFloor = arrived && placement.pose === 'floor'
    // In bed (or the hammock) the body lines up with it exactly, not wherever the walk left it.
    if (lying) group.rotation.y = placement.facing
    const seated = !walking && (placement.seated || onFloor)
    if (leftLeg.current && rightLeg.current) {
      leftLeg.current.rotation.x = lying ? 0 : seated ? -Math.PI / 2.2 : swing
      rightLeg.current.rotation.x = lying ? 0 : seated ? -Math.PI / 2.2 : -swing
    }
    if (leftArm.current && rightArm.current) {
      const typing = !walking && (station.state === 'Working' || station.state === 'Reviewing')
      const talking = !walking && station.state === 'Collaborating'
      leftArm.current.rotation.x = lying ? 0 : walking ? -swing : typing ? -1.1 + Math.sin(time * 14) * 0.12 : talking ? -0.4 + Math.sin(time * 3) * 0.3 : 0
      rightArm.current.rotation.x = lying ? 0 : walking ? swing : typing ? -1.1 + Math.cos(time * 14) * 0.12 : 0
    }
    if (body.current) {
      // Lying down: the body tips back so the head rests towards the pillow (local -z).
      body.current.rotation.x += ((lying ? -Math.PI / 2 : 0) - body.current.rotation.x) * 0.2
      const talk = station.state === 'Collaborating' && !walking ? Math.abs(Math.sin(time * 5)) * 0.03 : 0
      const breathe = station.state === 'Idle' ? Math.sin(time * (lying ? 1.2 : 2)) * 0.015 : 0
      body.current.position.y = lying ? (placement.height ?? 0.5) + 0.16 + breathe : (onFloor ? -0.5 : seated ? -0.14 : 0) + talk + breathe
    }
  })

  return <group ref={(node) => { root.current = node; groupRef(node) }} position={start}>
    <group ref={body} onClick={(event) => { event.stopPropagation(); onSelect(station, null) }} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      <mesh ref={leftLeg} position={[-0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={tint(colors.pants)} roughness={0.8}/></mesh>
      <mesh ref={rightLeg} position={[0.11, 0.66, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={tint(colors.pants)} roughness={0.8}/></mesh>
      <RBox position={[0, 0.98, 0]} size={[0.48, 0.58, 0.3]} radius={0.07} color={tint(colors.shirt)} roughness={0.85}/>
      <mesh ref={leftArm} position={[-0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={tint(colors.shirt)} roughness={0.85}/></mesh>
      <mesh ref={rightArm} position={[0.31, 1.2, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={tint(colors.shirt)} roughness={0.85}/></mesh>
      <RBox position={[0, 1.5, 0]} size={[0.4, 0.4, 0.37]} radius={0.08} color={tint(colors.skin)} roughness={0.7}/>
      <RBox position={[0, 1.72, -0.02]} size={[0.43, 0.13, 0.41]} radius={0.05} color={tint(colors.hair)} roughness={0.9}/>
      <RBox position={[0, 1.58, -0.19]} size={[0.43, 0.3, 0.06]} radius={0.03} color={tint(colors.hair)} roughness={0.9}/>
      <RBox position={[-0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
      <RBox position={[0.09, 1.52, 0.186]} size={[0.06, 0.07, 0.01]} radius={0.004} color="#17201e" shadow={false}/>
      <RBox position={[0, 1.4, 0.186]} size={[0.12, 0.025, 0.01]} radius={0.004} color="#9a5a44" shadow={false}/>
      {unknown && <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.55, 24]}/><meshBasicMaterial color="#e9c47b" transparent opacity={0.85}/></mesh>}
      <object3D ref={anchor} position={[0, 2.05, 0]}/>
    </group>
  </group>
}

// Legs and arms pivot at the hip / shoulder: translate the geometry so its top sits at the origin.
const legGeometry = new THREE.BoxGeometry(0.17, 0.62, 0.2).translate(0, -0.31, 0)
const armGeometry = new THREE.BoxGeometry(0.12, 0.52, 0.14).translate(0, -0.26, 0)

/**
 * Screen-space labels: each frame, project every anchor into the canvas and move its DOM label
 * there directly (no React re-render). Labels live outside the Canvas, so they unmount cleanly
 * and use the page's own styles and focus handling.
 */
function LabelProjector({ anchors, labels }: { anchors: Registry<THREE.Object3D>; labels: Registry<HTMLElement> }) {
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const projected: { element: HTMLElement; x: number; y: number; depth: number }[] = []
    for (const [key, object] of anchors.current) {
      const element = labels.current.get(key)
      if (!element) continue
      let shown = true
      for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) { shown = false; break }
      object.getWorldPosition(point).project(camera)
      const visible = shown && point.z < 1 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1
      element.style.visibility = visible ? 'visible' : 'hidden'
      if (visible) projected.push({ element, x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height, depth: point.z })
    }
    // Nearest labels keep their spot; a farther label that would overlap one already placed is
    // lifted above it, so every agent stays readable and clickable.
    projected.sort((a, b) => a.depth - b.depth)
    const placed: { left: number; right: number; top: number; bottom: number }[] = []
    for (const label of projected) {
      const width = label.element.offsetWidth
      const height = label.element.offsetHeight
      const x = Math.min(Math.max(label.x, width / 2 + 4), size.width - width / 2 - 4)
      let bottom = label.y
      const left = x - width / 2
      const right = x + width / 2
      for (let guard = 0; guard < 6; guard += 1) {
        const hit = placed.find((box) => left < box.right && right > box.left && bottom - height < box.bottom && bottom > box.top)
        if (!hit) break
        bottom = hit.top - 4
      }
      placed.push({ left, right, top: bottom - height, bottom })
      label.element.style.transform = `translate(${x}px, ${Math.max(bottom, height + 4)}px) translate(-50%, -100%)`
      label.element.style.zIndex = String(Math.round((1 - label.depth) * 10_000))
    }
  })
  return null
}

/** POV mode: the camera sits at the agent's eyes and looks where they face,
    every frame — so it walks, snacks and rides the stairs with them. It runs
    after the characters' own useFrame (mount order), so it reads the position
    they just moved to, and before the Controls' useFrame, which stands down
    while POV is active. Camera only: no data, no new endpoints. */
function PovCamera({ agentId, groups, eyeHeight, active }: { agentId: string | null; groups: Registry<THREE.Group>; eyeHeight: number; active: boolean }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!active || !agentId) return
    const group = groups.current.get(agentId)
    if (!group) return
    const { eye, target } = povView(group.position, group.rotation.y, eyeHeight)
    camera.position.copy(eye)
    camera.lookAt(target)
  })
  return null
}

export interface ViewHandle {
  reset: () => void
  /** Hold-to-rotate: start turning the camera in `direction` (1 = right, -1 = left). */
  rotateStart: (direction: 1 | -1) => void
  /** Stop a held rotation. */
  rotateStop: () => void
  /** One fixed step (15°) in `direction`, e.g. for keyboard activation. */
  rotateStep: (direction: 1 | -1) => void
  /** Fly the camera to `position` looking at `target` (eased, ~1.2 s). */
  flyTo: (position: Vec3, target: Vec3, durationMs?: number) => void
}

/** Manual rotate speed for the on-screen buttons: ~57° per second held. */
const MANUAL_ROTATE_SPEED = 1.0
/** One tap / keyboard press turns the camera this far. */
const MANUAL_ROTATE_STEP = Math.PI / 12

/** Idle delay before the public showroom rotation resumes after a manual zoom/pan. */
export const PUBLIC_AUTOROTATE_RESUME_MS = 10_000

/** One camera flight: eased interpolation between two views, driven by wall
    clock in useFrame so it finishes on time even at headless frame rates. */
interface Flight { fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; start: number; duration: number }

/** Orbit (drag), pan (right-drag, two fingers, arrow keys or pan mode) and zoom, kept in bounds. */
const Controls = forwardRef<ViewHandle, { panMode: boolean; keyTarget: HTMLElement | null; layout: OfficeLayout; elevation: number; publicMode?: boolean; povActive?: boolean; onUserMove?: () => void }>(function Controls({ panMode, keyTarget, layout, elevation, publicMode = false, povActive = false, onUserMove }, handle) {
  const { camera, gl, size } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  const resumeTimer = useRef<number | undefined>(undefined)
  const manualRotate = useRef<0 | 1 | -1>(0)
  const flightRef = useRef<Flight | null>(null)
  /** The orbit view the user had before entering POV, so exiting returns
      them to exactly where they were — not to the default view. */
  const savedView = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const onUserMoveRef = useRef(onUserMove)
  useEffect(() => { onUserMoveRef.current = onUserMove })
  const { target: cameraTarget, offset: cameraOffset } = layout.camera
  const target = useMemo(() => new THREE.Vector3(...cameraTarget), [cameraTarget])
  /** The default view (Depan): computed from the layout, aspect and floor. */
  const computeDefaultView = useMemo(() => () => {
    const aspect = size.width / Math.max(size.height, 1)
    const offset = new THREE.Vector3(...cameraOffset)
    // Narrow (portrait) views need to back off so the whole building fits across.
    offset.setLength(offset.length() * Math.max(1, 1.2 / aspect))
    const focus = target.clone().set(aspect < 1 ? cameraTarget[0] - 1.4 : cameraTarget[0], cameraTarget[1] + elevation, aspect < 1 ? 0.8 : cameraTarget[2])
    return { position: focus.clone().add(offset), target: focus }
  }, [size.width, size.height, target, cameraOffset, cameraTarget, elevation])
  const frame = useMemo(() => () => {
    // A camera flight owns the camera while it runs; a resize mid-flight must not snap it.
    if (flightRef.current) return
    const { position, target: focus } = computeDefaultView()
    const orbit = controls.current
    // An undamped update applies and clears any momentum left from an earlier drag,
    // so it has to happen before the camera is placed, not after.
    if (orbit) { orbit.enableDamping = false; orbit.update() }
    camera.position.copy(position)
    camera.lookAt(focus)
    if (!orbit) return
    orbit.target.copy(focus)
    orbit.update()
    orbit.enableDamping = true
  }, [camera, computeDefaultView])

  /** Rotate the camera around the target by `angle` radians (positive turns
      the scene clockwise as seen on screen). */
  const rotateCameraBy = (angle: number) => {
    const orbit = controls.current
    if (!orbit) return
    const offset = camera.position.clone().sub(orbit.target)
    camera.position.copy(orbit.target).add(rotateOffsetY(offset, angle))
    camera.lookAt(orbit.target)
  }
  /** Public view: a manual interaction pauses the showroom rotation at once… */
  const pauseAutoRotate = () => {
    if (!publicMode) return
    const orbit = controls.current
    if (orbit) orbit.autoRotate = false
    window.clearTimeout(resumeTimer.current)
  }
  /** …and it resumes by itself after 10 s without input. Admin has no
      auto-rotate, so nothing is resumed there. */
  const scheduleAutoRotateResume = () => {
    if (!publicMode) return
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => {
      const orbit = controls.current
      if (orbit) orbit.autoRotate = true
    }, PUBLIC_AUTOROTATE_RESUME_MS)
  }
  /** Fly the camera to `position` looking at `target`, eased. The controls
      are off during the flight; any pointer or wheel input cancels it and
      hands the camera back to the user where it is. */
  const flyTo = (position: Vec3, target: Vec3, durationMs: number = PRESET_FLIGHT_MS) => {
    const orbit = controls.current
    if (!orbit) return
    pauseAutoRotate()
    orbit.enabled = false
    orbit.autoRotate = false
    flightRef.current = {
      fromPos: camera.position.clone(),
      fromTarget: orbit.target.clone(),
      toPos: new THREE.Vector3(...position),
      toTarget: new THREE.Vector3(...target),
      start: performance.now(),
      duration: durationMs,
    }
  }
  const finishFlight = (cancelled: boolean) => {
    const flight = flightRef.current
    if (!flight) return
    flightRef.current = null
    const orbit = controls.current
    if (!cancelled) {
      camera.position.copy(flight.toPos)
      camera.lookAt(flight.toTarget)
      if (orbit) orbit.target.copy(flight.toTarget)
    }
    if (orbit) {
      orbit.enabled = true
      orbit.autoRotate = publicMode
    }
    scheduleAutoRotateResume()
  }

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    orbit.enableDamping = true
    orbit.screenSpacePanning = false // pan across the floor, not up into the sky
    orbit.minDistance = 5
    // Portrait needs room to back off: the frame() offset is ~69 at 390px wide,
    // so 48 used to clamp it and crop the game room and the gang off-frame.
    orbit.maxDistance = 72
    orbit.minPolarAngle = 0.2
    orbit.maxPolarAngle = 1.32
    orbit.keyPanSpeed = 25
    // Public view: the camera slowly turns on its own, like a showroom.
    orbit.enabled = true
    // Rotate stays on at the OrbitControls level: the two-finger twist
    // (TOUCH.DOLLY_ROTATE) only rotates when enableRotate is true — with it
    // off, a twist silently becomes pinch-zoom only, which is exactly what
    // Ricky reported. Public mode still cannot rotate by mouse or one finger:
    // those are mapped to PAN below, so the only manual rotate is the
    // two-finger gesture and the on-screen buttons.
    orbit.enableRotate = true
    orbit.enableZoom = true
    orbit.enablePan = true
    orbit.autoRotate = publicMode
    orbit.autoRotateSpeed = 0.5
    controls.current = orbit
    // Public view: any manual zoom or pan pauses the showroom rotation at once; it
    // resumes by itself after 10 s without input (mouse and touch alike). Admin has
    // no auto-rotate, so nothing is resumed there. A manual move also clears the
    // active camera preset (the view is no longer exactly that preset).
    const onStart = () => { pauseAutoRotate(); onUserMoveRef.current?.() }
    const onEnd = () => scheduleAutoRotateResume()
    orbit.addEventListener('start', onStart)
    orbit.addEventListener('end', onEnd)
    // True two-finger twist: OrbitControls' DOLLY_ROTATE rotates from the
    // midpoint's displacement, so a pure twist (fingers circling each other,
    // midpoint still) rotates nothing even with enableRotate on. Track the
    // angle between the two touch pointers ourselves and turn the camera by
    // its change. Screen y grows downwards, so a clockwise finger twist gives
    // a positive delta, and turning the camera counter-clockwise around the
    // target makes the scene turn clockwise with the fingers. (Sign reasoned
    // from the geometry, not device-tested: no headless browser can twist two
    // fingers, so Ricky's phone is the real check.)
    const touchPoints = new Map<number, { x: number; y: number }>()
    let twistAngle: number | null = null
    const twistAngleOf = () => {
      const [a, b] = [...touchPoints.values()]
      return Math.atan2(b.y - a.y, b.x - a.x)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.size === 2) twistAngle = twistAngleOf()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!touchPoints.has(event.pointerId)) return
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.size !== 2 || twistAngle === null) return
      const next = twistAngleOf()
      const delta = wrapAngleDelta(next - twistAngle)
      twistAngle = next
      rotateCameraBy(delta)
    }
    const onPointerUp = (event: PointerEvent) => {
      touchPoints.delete(event.pointerId)
      if (touchPoints.size < 2) twistAngle = null
    }
    gl.domElement.addEventListener('pointerdown', onPointerDown)
    gl.domElement.addEventListener('pointermove', onPointerMove)
    gl.domElement.addEventListener('pointerup', onPointerUp)
    gl.domElement.addEventListener('pointercancel', onPointerUp)
    // Any pointer or wheel input cancels a camera flight at once (the intro
    // included) and hands the camera back to the user where it is.
    const cancelFlight = () => { if (flightRef.current) { finishFlight(true); onUserMoveRef.current?.() } }
    gl.domElement.addEventListener('pointerdown', cancelFlight)
    gl.domElement.addEventListener('wheel', cancelFlight, { passive: true })
    // Fly-through intro, once per browser session: the Canvas camera already
    // starts far and high (see Office3D); ease into the default view.
    if (!introSeen()) {
      markIntroSeen()
      const to = computeDefaultView()
      flyTo(to.position.toArray() as Vec3, to.target.toArray() as Vec3, INTRO_DURATION_MS)
    } else {
      frame()
    }
    return () => {
      window.clearTimeout(resumeTimer.current)
      orbit.removeEventListener('start', onStart)
      orbit.removeEventListener('end', onEnd)
      gl.domElement.removeEventListener('pointerdown', onPointerDown)
      gl.domElement.removeEventListener('pointermove', onPointerMove)
      gl.domElement.removeEventListener('pointerup', onPointerUp)
      gl.domElement.removeEventListener('pointercancel', onPointerUp)
      gl.domElement.removeEventListener('pointerdown', cancelFlight)
      gl.domElement.removeEventListener('wheel', cancelFlight)
      orbit.dispose(); controls.current = null
    }
    // frame() only sets the initial view; re-running it on resize is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl])
  // A resize or floor change re-frames the orbit view — but never while the
  // PovCamera owns the camera (it would snap the view for a frame).
  useEffect(() => { if (!povActive) frame() }, [frame, povActive])
  // POV on / off: entering saves the orbit view, cancels any flight and hands
  // the camera to the PovCamera (the orbit controls stand down); exiting
  // puts the camera back where it was and hands the controls back. The
  // public showroom rotation resumes on exit exactly as before.
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    if (povActive) {
      savedView.current = { position: camera.position.clone(), target: orbit.target.clone() }
      flightRef.current = null
      window.clearTimeout(resumeTimer.current)
      orbit.enabled = false
      orbit.autoRotate = false
    } else {
      const saved = savedView.current
      savedView.current = null
      if (saved) {
        camera.position.copy(saved.position)
        orbit.target.copy(saved.target)
        camera.lookAt(saved.target)
        orbit.update()
      }
      orbit.enabled = true
      orbit.autoRotate = publicMode
    }
  }, [povActive, publicMode, camera])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    if (publicMode) {
      // No manual rotate in public view: drag pans, wheel and pinch zoom, and two
      // fingers rotate (twist) and pinch-zoom — the showroom stays view-only.
      orbit.mouseButtons.LEFT = THREE.MOUSE.PAN
      orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN
      orbit.touches.ONE = THREE.TOUCH.PAN
      orbit.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
    } else {
      orbit.mouseButtons.LEFT = panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
      orbit.mouseButtons.RIGHT = panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
      orbit.touches.ONE = panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
    }
  }, [panMode, publicMode])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit || !keyTarget) return
    orbit.listenToKeyEvents(keyTarget)
    return () => orbit.stopListenToKeyEvents()
  }, [keyTarget])
  useImperativeHandle(handle, () => ({
    reset: frame,
    rotateStart: (direction: 1 | -1) => { pauseAutoRotate(); manualRotate.current = direction },
    rotateStop: () => { manualRotate.current = 0; scheduleAutoRotateResume() },
    rotateStep: (direction: 1 | -1) => { pauseAutoRotate(); rotateCameraBy(direction * MANUAL_ROTATE_STEP); scheduleAutoRotateResume() },
    flyTo,
  }), [frame, publicMode])

  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    // POV owns the camera: the orbit controls, the flights and the manual
    // rotate all stand down until the user exits.
    if (povActive) return
    const flight = flightRef.current
    if (flight) {
      const t = easeInOutCubic((performance.now() - flight.start) / flight.duration)
      camera.position.lerpVectors(flight.fromPos, flight.toPos, t)
      orbit.target.lerpVectors(flight.fromTarget, flight.toTarget, t)
      camera.lookAt(orbit.target)
      if (t >= 1) finishFlight(false)
      return
    }
    // Clamp the frame delta: after a long pause (tab/app switch, or a slow
    // headless screenshot) the raw delta can be tens of seconds, and one
    // frame would otherwise spin the camera by delta * speed radians.
    // At 60fps delta is ~0.017s, so the clamp never affects real use.
    const dt = Math.min(delta, 0.1)
    if (manualRotate.current !== 0) rotateCameraBy(manualRotate.current * MANUAL_ROTATE_SPEED * dt)
    orbit.update()
    const [x, z] = clampTarget(orbit.target.x, orbit.target.z, layout.pan)
    if (x !== orbit.target.x || z !== orbit.target.z) {
      const shift = new THREE.Vector3(x - orbit.target.x, 0, z - orbit.target.z)
      orbit.target.add(shift)
      camera.position.add(shift)
    }
  })
  return null
})

function register<T>(registry: Registry<T>, key: string) {
  return (value: T | null) => { if (value) registry.current.set(key, value); else registry.current.delete(key) }
}

/** Current time, refreshed every `interval` ms. */
function useClock(interval: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(timer)
  }, [interval])
  return now
}

function useThemeName(): 'dark' | 'light' {
  const read = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const [theme, setTheme] = useState<'dark' | 'light'>(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

/** Day in the light theme; evening in the dark theme, when the lamps in the scene switch on.
    The switch is a ~2 s fade, not a flip: the shared night amount eases towards the
    theme's target every frame, and every light, the fog and the sky follow it.
    (On the very first frame the amount is set to the theme at once, so a
    dark-theme load does not flash day first.) */
function Lighting({ theme }: { theme: 'dark' | 'light' }) {
  const background = useRef<THREE.Color>(null)
  const fog = useRef<THREE.Fog>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  const initialized = useRef(false)
  useFrame((_, delta) => {
    const target = theme === 'dark' ? 1 : 0
    if (!initialized.current) {
      nightAmount.current = target
      initialized.current = true
    } else {
      nightAmount.current = easeNightAmount(nightAmount.current, target, delta)
    }
    const t = nightAmount.current
    const sky = DAY_NIGHT.sky
    if (background.current) lerpHex(background.current, sky.fogDay, sky.fogNight, t)
    if (fog.current) lerpHex(fog.current.color, sky.fogDay, sky.fogNight, t)
    if (hemi.current) {
      lerpHex(hemi.current.color, DAY_NIGHT.hemi.skyDay, DAY_NIGHT.hemi.skyNight, t)
      lerpHex(hemi.current.groundColor, DAY_NIGHT.hemi.groundDay, DAY_NIGHT.hemi.groundNight, t)
      hemi.current.intensity = mix(DAY_NIGHT.hemi.day, DAY_NIGHT.hemi.night, t)
    }
    if (sun.current) {
      lerpHex(sun.current.color, DAY_NIGHT.sun.colorDay, DAY_NIGHT.sun.colorNight, t)
      sun.current.intensity = mix(DAY_NIGHT.sun.day, DAY_NIGHT.sun.night, t)
    }
    if (ambient.current) {
      lerpHex(ambient.current.color, DAY_NIGHT.ambient.colorDay, DAY_NIGHT.ambient.colorNight, t)
      ambient.current.intensity = mix(DAY_NIGHT.ambient.day, DAY_NIGHT.ambient.night, t)
    }
  })
  return <>
    <color ref={background} attach="background" args={[DAY_NIGHT.sky.fogDay]}/>
    <fog ref={fog} attach="fog" args={[DAY_NIGHT.sky.fogDay, 38, 120]}/>
    <hemisphereLight ref={hemi} args={['#fff4e0', '#5d7a4c', 1.1]}/>
    <directionalLight ref={sun} position={[10, 16, 9]} intensity={2.4} color="#fff1d6" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-far={60}/>
    <ambientLight ref={ambient} intensity={0.35} color="#ffffff"/>
  </>
}

const FLOORS: { floor: Floor; label: string; title: string }[] = [
  { floor: 2, label: 'Kamar & Balkon', title: 'Lantai 2: bedroom, lesehan and balcony' },
  { floor: 1, label: 'Kantor', title: 'Lantai 1: office, lounge, pantry and game room' },
]
const FLOOR_KEY = 'mc.officeFloor'
const SLEEP_KEY = 'mc.officeSleep'

/** An on/off preference kept per browser. */
function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  return [value, (next: boolean) => {
    setValue(next)
    try { localStorage.setItem(key, next ? '1' : '0') } catch { /* per-browser convenience only */ }
  }]
}

function useFloor(): [Floor, (floor: Floor) => void] {
  const [floor, setFloor] = useState<Floor>(() => {
    try { return localStorage.getItem(FLOOR_KEY) === '2' ? 2 : 1 } catch { return 1 }
  })
  return [floor, (next: Floor) => {
    setFloor(next)
    try { localStorage.setItem(FLOOR_KEY, String(next)) } catch { /* per-browser convenience only */ }
  }]
}

/** Floor switcher (Kantor / Kamar & Balkon). View-only, so it stays on in public mode too. */
export function FloorButtons({ floor, onFloor, counts }: { floor: Floor; onFloor: (floor: Floor) => void; counts: (floor: Floor) => number }) {
  return <div className="office-3d-floors" role="group" aria-label="Floors">
    {FLOORS.map((item) => <button key={item.floor} type="button" className={floor === item.floor ? 'active' : ''} aria-pressed={floor === item.floor} onClick={() => onFloor(item.floor)} title={`${item.title} (Page ${item.floor === 2 ? 'Up' : 'Down'})`}>
      <b>{item.floor}</b><span>{item.label}</span><small>{counts(item.floor)}</small>
    </button>)}
  </div>
}

/** On-screen rotate buttons (hold to turn, tap for one step). Camera-only, so
    they show in public mode too — the deterministic way to rotate on a phone,
    where the two-finger twist was only ever config-verified. */
export function RotateButtons({ view }: { view: { current: ViewHandle | null } }) {
  const held = useRef<1 | -1 | 0>(0)
  const start = (direction: 1 | -1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* older browsers: the hold ends on pointer leave */ }
    held.current = direction
    view.current?.rotateStart(direction)
  }
  const stop = () => {
    if (held.current === 0) return
    held.current = 0
    view.current?.rotateStop()
  }
  const step = (direction: 1 | -1) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Keyboard activation fires click without a pointer press (detail 0); a
    // pointer tap already rotated via the hold, so it must not step again.
    if (event.detail === 0) view.current?.rotateStep(direction)
  }
  return <div className="office-3d-rotate" role="group" aria-label="Putar kamera">
    <button type="button" aria-label="Putar kiri" title="Putar kamera ke kiri (tahan)" onPointerDown={start(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={(event) => event.preventDefault()} onClick={step(-1)}>⟲</button>
    <button type="button" aria-label="Putar kanan" title="Putar kamera ke kanan (tahan)" onPointerDown={start(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onLostPointerCapture={stop} onContextMenu={(event) => event.preventDefault()} onClick={step(1)}>⟳</button>
  </div>
}

/** Camera presets (Depan / Jalan / Pasar / Atas): eased flights to fixed
    viewpoints. Camera-only, so they show in public mode too. */
export function CameraPresets({ view, active, onPreset }: { view: { current: ViewHandle | null }; active: string | undefined; onPreset: (id: string) => void }) {
  const go = (id: string) => () => {
    onPreset(id)
    if (id === 'depan') { view.current?.reset(); return }
    const preset = CAMERA_PRESETS.find((item) => item.id === id)
    if (preset) view.current?.flyTo(preset.view.position, preset.view.target)
  }
  return <div className="office-3d-presets" role="group" aria-label="Sudut kamera">
    {[{ id: 'depan', label: 'Depan', title: 'Kembali ke tampilan awal' }, ...CAMERA_PRESETS].map((item) => <button key={item.id} type="button" className={active === item.id ? 'active' : ''} aria-pressed={active === item.id} onClick={go(item.id)} title={item.title}>{item.label}</button>)}
  </div>
}

/** POV mode: "become the character's eyes". A chip row of the 7 agents under
    the screen (the main way, mobile-friendly) — tap a chip to see through
    that agent's eyes, tap another to switch, tap "Keluar dari POV" to return
    to the orbit view. Camera only, so it shows in public mode too. */
export function PovBar({ stations, activeId, onEnter, onExit }: { stations: OfficeStation[]; activeId: string | null; onEnter: (id: string) => void; onExit: () => void }) {
  const active = activeId ? stations.find((station) => station.id === activeId) : undefined
  return <div className="office-3d-pov" role="group" aria-label="Lihat dari mata agen">
    {active ? <><span className="pov-active">👁 Melihat dari mata {active.name}</span><button type="button" className="pov-exit" onClick={onExit}>Keluar dari POV</button></> : <span className="pov-label" aria-hidden="true">👁 Lihat dari mata:</span>}
    {stations.map((station) => <button key={station.id} type="button" className={activeId === station.id ? 'active' : ''} aria-pressed={activeId === station.id} onClick={() => onEnter(station.id)} title={`Lihat dari mata ${station.name}`}>{station.name}</button>)}
  </div>
}

export default function Office3D({ stations, onSelect, publicMode = false, povAgentId = null, onEnterPov, onExitPov }: { stations: OfficeStation[]; onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void; publicMode?: boolean; povAgentId?: string | null; onEnterPov?: (id: string) => void; onExitPov?: () => void }) {
  const anchors = useRef(new Map<string, THREE.Object3D>())
  const labels = useRef(new Map<string, HTMLElement>())
  const agentGroups = useRef(new Map<string, THREE.Group>())
  const view = useRef<ViewHandle>(null)
  const [panMode, setPanMode] = useState(false)
  const [preset, setPreset] = useState<string | undefined>('depan')
  const [keyTarget, setKeyTarget] = useState<HTMLElement | null>(null)
  // The agent a click just picked, waiting for "Lihat dari mata X" — cleared
  // when POV starts, when the prompt is dismissed, or when POV is exited.
  const [candidate, setCandidate] = useState<OfficeStation | null>(null)
  const povStation = povAgentId ? stations.find((station) => station.id === povAgentId) : undefined
  // A click on a character (3D mesh or label) picks them for POV and, in
  // admin, still opens the station details as before.
  const handleSelect = (station: OfficeStation, trigger: HTMLElement | null) => {
    setCandidate(station)
    onSelect(station, trigger)
  }
  // Escape leaves POV (both modes — the container key handler is admin-only).
  useEffect(() => {
    if (!povAgentId || !onExitPov) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onExitPov() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [povAgentId, onExitPov])
  // A POV agent that left the crew (server restart, crew change) leaves no
  // camera behind: exit instead of staring at the last frame forever.
  useEffect(() => {
    if (povAgentId && !povStation && onExitPov) onExitPov()
  }, [povAgentId, povStation, onExitPov])
  const theme = useThemeName()
  const [floor, setFloor] = useFloor()
  const [sleepMode, setSleepMode] = useStoredFlag(SLEEP_KEY)
  const now = useClock(2000)
  // One unlabeled desk per agent (hot desking); the building is sized for the crew.
  const layout = useMemo(() => createLayout(stations.length), [stations.length])
  // Fly-through intro, once per browser session: the camera starts far and
  // high above the default target (the Controls flight eases it in on mount).
  const introPending = useMemo(() => !introSeen(), [])
  const introStart = useMemo(() => introStartView([layout.camera.target[0], layout.camera.target[1] + (floor === 2 ? FLOOR_HEIGHT : 0), layout.camera.target[2]]).position, [layout, floor])
  // Idle agents wander between the lounge, the game room, the pantry, the street food and
  // lantai 2 (decorative only), spread so no two share a spot. With sleep mode on, every idle
  // agent goes to bed upstairs instead.
  const idleSeats = stations.filter((station) => station.state === 'Idle' && station.room === 'Lounge').map((station) => station.seat)
  const plan = idlePlan(idleSeats, now, layout, publicMode ? [] : sleepMode ? idleSeats : [])
  const wandering = (station: OfficeStation) => station.state === 'Idle' && station.room === 'Lounge' ? plan.get(station.seat) : undefined
  // Street traffic state: the 3D scene writes it (the buyer on the motorcycle),
  // the bubbles below read it. Re-renders come from the 2 s clock, so it lags at most that.
  const trafficRef = useRef<TrafficState>({ buyers: [] })
  // Ricky the promoter's position: the 3D scene writes it every frame, the label
  // below reads it (as data-x / data-y / data-z, for verification) — and the UFO
  // hooks into it, since he is one of its victims.
  const promoterRef = useRef<PromoterPosition | null>(null)
  // The pedestrians' positions: the 3D scene writes them every frame, so the
  // UFO can pick one of them as its victim (and verification can watch).
  const pedPositionsRef = useRef<(PedestrianPosition | null)[]>([null, null, null])
  // The UFO abduction in progress: the UFO writes it, the walkers read it
  // (freeze, rise, hide, come back down somewhere else).
  const abductionRef = useRef<UfoAbduction | null>(null)
  // The UFO's status for its label (data-ufo-phase / victim / lift-y, for
  // verification): the 3D scene writes it, the label below reads it.
  const ufoRef = useRef<UfoStatus>({ phase: 'idle', victim: null, lastVictim: null, liftY: 0, history: [], maxLiftY: 0, abductAt: null, dropAt: null })
  // Verification hook (harmless in production — nobody passes it by accident):
  // ?ufo=soon starts the first event ~3 s after load; ?ufo=ricky also forces
  // Ricky as the victim; ?ufo=ped forces a random pedestrian; ?ufo=hold
  // forces Ricky and freezes the event in the beam phase (headless screenshots
  // take ~20 s, longer than a 3.5 s phase, so a still shot of the beam needs
  // the event held); ?ufo=holdlift freezes it once Ricky is halfway up the
  // beam, for a still shot of the lift.
  const ufoHook = useMemo(() => {
    try {
      const query = new URLSearchParams(window.location.search).get('ufo')
      if (query === 'ricky') return { firstIn: 3, forcedVictim: 'ricky' as UfoVictimId, holdBeam: false, holdLift: false }
      if (query === 'ped') return { firstIn: 3, forcedVictim: 'ped-0' as UfoVictimId, holdBeam: false, holdLift: false }
      if (query === 'hold') return { firstIn: 3, forcedVictim: 'ricky' as UfoVictimId, holdBeam: true, holdLift: false }
      if (query === 'holdlift') return { firstIn: 3, forcedVictim: 'ricky' as UfoVictimId, holdBeam: false, holdLift: true }
      if (query === 'soon') return { firstIn: 3, forcedVictim: null as UfoVictimId | null, holdBeam: false, holdLift: false }
    } catch { /* no hook */ }
    return { firstIn: undefined, forcedVictim: null as UfoVictimId | null, holdBeam: false, holdLift: false }
  }, [])
  // Snack exchanges: an idle agent at a food stall, in the exchange window, orders
  // and the vendor answers. Canned lines, no task data, so they show in public too.
  const isFoodStall = (key: string): key is FoodStall => (FOOD_STALLS as readonly string[]).includes(key)
  const exchanges = stations.flatMap((station) => {
    const assignment = wandering(station)
    if (!assignment || !isFoodStall(assignment.stop.key) || !inExchangeWindow(now)) return []
    const lines = exchangeFor(assignment.stop.key, now)
    if (!lines) return []
    return [{ stall: assignment.stop.key, agentId: station.id, agentLine: lines.agent, vendorLine: lines.vendor }]
  })
  // What a vendor says right now: the buyer on the motorcycle first, then an agent
  // ordering at the stall, then the usual call-out.
  const vendorLine = (key: StreetKey): string | null => {
    const stoppedBuyer = trafficRef.current.buyers.find((item) => item.stall === key)
    if (stoppedBuyer) return exchangeLines(key, now)?.vendor ?? null
    const exchange = exchanges.find((item) => item.stall === key)
    if (exchange) return exchange.vendorLine
    return streetLine(key, now)
  }
  const buyers = trafficRef.current.buyers
  // Meeting dialogue: while ISA and Richkeyrick AI are Collaborating on the
  // same task they discuss it — ISA plans, Richkeyrick AI builds. Generated
  // from the task title in general terms (never the detail), so it shows in
  // public too, like the canned snack exchanges.
  const meeting = meetingSubject(stations)
  const dialogue = meeting ? meetingLine(meeting, now) : null
  // Agents at the meeting table take the next free place around it.
  const meetingOrder = stations.filter((station) => station.roomPosition === 'meeting-area').map((station) => station.id)
  const placement = (station: OfficeStation) => wandering(station)?.placement ?? placementFor(station, layout, Math.max(0, meetingOrder.indexOf(station.id)))
  // POV eye height follows the agent's pose (standing / sitting / lying), and
  // the floor view follows them upstairs: without it the camera would ride
  // into a floor that is not drawn.
  const povPlacement = povStation ? placement(povStation) : undefined
  const povEye = povPlacement ? povEyeHeight(povPlacement.pose, povPlacement.seated) : 1.55
  const povFloor = povPlacement ? floorOf(povPlacement.position) : null
  useEffect(() => {
    if (povAgentId && povFloor !== null && povFloor !== floor) setFloor(povFloor)
  }, [povAgentId, povFloor, floor, setFloor])
  const floorCount = (value: Floor) => stations.filter((station) => floorOf(placement(station).position) === value).length
  const occupiedSeats = new Set(stations.filter((station) => station.room === 'Workspace' && station.roomPosition !== 'meeting-area' && station.state !== 'Offline').map((station) => station.seat))
  return <div className={`office-3d${publicMode ? ' public' : ''}`} ref={setKeyTarget} tabIndex={publicMode ? -1 : 0} role="region" aria-label={publicMode ? 'Live view of the 3D office. View-only: scroll to zoom, drag to pan, two fingers to rotate and pinch to zoom.' : '3D office. Drag to rotate, right-drag or two fingers to pan, scroll to zoom, arrow keys pan when focused. Page Up and Page Down change floors.'} onKeyDown={publicMode ? undefined : (event) => {
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); setFloor(event.key === 'PageUp' ? 2 : 1) }
  }}>
    <Canvas shadows dpr={[1, 2]} camera={{ position: introPending ? introStart : [-3, 13, 16], fov: 40, near: 0.5, far: 400 }} gl={{ antialias: true }}>
      <Lighting theme={theme}/>
      <SkyDome/>
      <AmbientParticles layout={layout}/>
      <Environment layout={layout} floor={floor} registerAnchor={(key) => register(anchors, key)}/>
      <StreetTraffic layout={layout} registerAnchor={(key) => register(anchors, key)} trafficRef={trafficRef}/>
      <Pedestrians layout={layout} positionsRef={pedPositionsRef} abductionRef={abductionRef}/>
      <PromoterRicky layout={layout} registerAnchor={(key) => register(anchors, key)} positionRef={promoterRef} abductionRef={abductionRef}/>
      <Ufo layout={layout} registerAnchor={(key) => register(anchors, key)} pedPositions={pedPositionsRef} promoterPosition={promoterRef} abductionRef={abductionRef} statusRef={ufoRef} firstIn={ufoHook.firstIn} forcedVictim={ufoHook.forcedVictim} holdBeam={ufoHook.holdBeam} holdLift={ufoHook.holdLift}/>
      {floor === 1 && layout.desks.map((position, index) => <WorkDesk key={index} position={position} active={occupiedSeats.has(index + 1)} withChair/>)}
      {stations.map((station) => <Character key={station.id} station={station} placement={placement(station)} layout={layout} floor={floor} onSelect={handleSelect} anchor={register(anchors, `agent-${station.id}`)} groupRef={register(agentGroups, station.id)} hidden={povAgentId === station.id}/>)}
      <PovCamera agentId={povAgentId} groups={agentGroups} eyeHeight={povEye} active={povAgentId !== null}/>
      <LabelProjector anchors={anchors} labels={labels}/>
      <Controls key={layout.deskCount} ref={view} panMode={panMode} keyTarget={keyTarget} layout={layout} elevation={floor === 2 ? FLOOR_HEIGHT : 0} publicMode={publicMode} povActive={povAgentId !== null} onUserMove={() => setPreset(undefined)}/>
    </Canvas>
    <div className="office-3d-labels">
      {stations.map((station) => {
        const badge = officeStateBadge(station.state)
        const busy = ['Working', 'Reviewing', 'Collaborating'].includes(station.state)
        const idle = wandering(station)
        const exchange = exchanges.find((item) => item.agentId === station.id)
        // The meeting dialogue is the only bubble the two meeting agents show:
        // while they discuss the task, their plain activity line stays hidden
        // (it would stack a second bubble and read like a second speaker).
        const inMeeting = meeting !== null && (station.id === 'isa' || station.id === 'richkeyrick')
        // Public view shows the state only — the speech bubbles carry task titles
        // (station.activity) and idle-stop labels, so both stay hidden there. The
        // snack-exchange line and the meeting dialogue are generated from the task
        // title in general terms, not task data, so they show in both.
        return <button key={station.id} ref={register(labels, `agent-${station.id}`)} type="button" className={`agent-tag-3d state-${station.state.toLowerCase()}`} onClick={(event) => handleSelect(station, event.currentTarget)} aria-label={publicMode ? `${station.name}. ${station.state}. Ketuk untuk melihat dari mata ${station.name}.` : `${station.name}. ${station.state}.${station.activity ? ` ${station.activity}.` : ''}${idle ? ` ${idle.placement.label ?? idle.stop.label}.` : ''} Open station details.`}>
          {dialogue && dialogue.speaker === station.id && <span className="speech speech-3d">{dialogue.line}</span>}
          {exchange && <span className="speech speech-3d">{exchange.agentLine}</span>}
          {!publicMode && busy && station.activity && !inMeeting && <span className="speech speech-3d">{station.activity}</span>}
          {!publicMode && idle && !exchange && <span className={`speech speech-3d speech-idle${idle.placement.pose === 'lie' ? ' speech-sleep' : ''}`}>{idle.placement.pose === 'lie' ? '💤 ' : ''}{idle.placement.label ?? idle.stop.label}</span>}
          <span className="agent-tag-row"><span className="pixel-station-name">{station.privacy === 'locked' ? '🔒 ' : ''}{station.name}</span><span className={`badge ${badge.tone}`}>{station.state === 'Idle' ? 'Idle' : station.state}</span></span>
          {station.progressPercent !== undefined && <TaskProgressBar percent={station.progressPercent}/>}
        </button>
      })}
      {/* Street characters: name labels in the agent style, with a periodic call-out
          bubble (and the vendor's reply while someone is ordering at the stall). */}
      {STREET_KEYS.map((key) => {
        const line = vendorLine(key)
        return <span key={key} ref={register(labels, `street-${key}`)} className="street-tag" aria-hidden="true">
          {line && <span className="speech speech-3d">{line}</span>}
          <span className="pixel-station-name">{STREET_NAMES[key]}</span>
          {STREET_PRODUCT[key] && <span className="street-product">{STREET_PRODUCT[key]}</span>}
        </span>
      })}
      {/* Ricky the promoter: a scene character, not an agent — no % bar, no entry
          in the Agents list. His bubbles cycle through 4 promo lines. */}
      {(() => {
        const line = promoterLine(now)
        const position = promoterRef.current
        return <span ref={register(labels, 'street-ricky')} className="street-tag" aria-hidden="true" data-x={position?.x.toFixed(2)} data-y={position?.y.toFixed(2)} data-z={position?.z.toFixed(2)}>
          {line && <span className="speech speech-3d">{line}</span>}
          <span className="pixel-station-name">Ricky</span>
          <span className="street-product">Promosi</span>
        </span>
      })()}
      {/* The UFO: its label follows it across the sky, with a bubble while the
          alien is out — and data attributes for verification (phase, victim,
          how high the victim is being lifted, and the record of the event:
          the phases visited, the highest lift, and where the victim was taken
          from and dropped off). Hidden while the UFO is away. */}
      {(() => {
        const status = ufoRef.current
        const line = UFO_LINES[status.phase]
        return <span ref={register(labels, 'ufo')} className="street-tag" aria-hidden="true" data-ufo-phase={status.phase} data-ufo-victim={status.victim ?? status.lastVictim ?? ''} data-lift-y={status.liftY.toFixed(2)} data-ufo-history={status.history.join(',')} data-lift-max={status.maxLiftY.toFixed(1)} data-abduct-x={status.abductAt?.x.toFixed(1) ?? ''} data-abduct-z={status.abductAt?.z.toFixed(1) ?? ''} data-drop-x={status.dropAt?.x.toFixed(1) ?? ''} data-drop-z={status.dropAt?.z.toFixed(1) ?? ''}>
          {line && <span className="speech speech-3d">{line}</span>}
          <span className="pixel-station-name">🛸 UFO</span>
        </span>
      })()}
      {buyers.map((buyer) => {
        const lines = exchangeLines(buyer.stall, now)
        return <span key={buyer.index} ref={register(labels, `street-rider-${buyer.index}`)} className="street-tag" aria-hidden="true">
          {lines && <span className="speech speech-3d">{lines.agent}</span>}
          <span className="pixel-station-name">Pembeli</span>
        </span>
      })}
    </div>
    {/* While in POV the orbit controls (floors, presets, rotate, tools) stand
        down with the orbit camera — the POV bar below is the only camera UI,
        so the user can switch agents or exit without confusion. */}
    {!povAgentId && <><FloorButtons floor={floor} onFloor={setFloor} counts={floorCount}/>
    <CameraPresets view={view} active={preset} onPreset={setPreset}/>
    <RotateButtons view={view}/></>}
    {!publicMode && !povAgentId && <div className="office-3d-tools">
      <button type="button" className={sleepMode ? 'active sleep' : ''} aria-pressed={sleepMode} onClick={() => { setSleepMode(!sleepMode); if (!sleepMode && idleSeats.length > 0) setFloor(2) }} title="Send every idle agent to bed on lantai 2">💤 Tidur</button>
      <button type="button" className={panMode ? 'active' : ''} aria-pressed={panMode} onClick={() => setPanMode((value) => !value)} title="Drag moves the view instead of rotating it">✥ Geser</button>
      <button type="button" onClick={() => view.current?.reset()} title="Back to the starting view">↺ Reset view</button>
    </div>}
    <PovBar stations={stations} activeId={povAgentId} onEnter={(id) => { setCandidate(null); onEnterPov?.(id) }} onExit={() => { setCandidate(null); onExitPov?.() }}/>
    {candidate && candidate.id !== povAgentId && <div className="office-3d-pov-prompt" role="group" aria-label={`Lihat dari mata ${candidate.name}`}>
      <button type="button" onClick={() => { const id = candidate.id; setCandidate(null); onEnterPov?.(id) }}>👁 Lihat dari mata {candidate.name}</button>
      <button type="button" aria-label="Tutup" onClick={() => setCandidate(null)}>✕</button>
    </div>}
  </div>
}
