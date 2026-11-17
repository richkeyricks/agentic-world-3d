import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

/** Wrap an angle change to [-PI, PI] so crossing the -PI/PI seam does not spin the camera. */
export function wrapAngleDelta(delta: number): number {
  if (delta > Math.PI) return delta - 2 * Math.PI
  if (delta < -Math.PI) return delta + 2 * Math.PI
  return delta
}

/** A camera offset rotated around the world Y axis: the camera orbits the
    target without changing distance or height. */
export function rotateOffsetY(offset: THREE.Vector3, angle: number): THREE.Vector3 {
  return offset.clone().applyAxisAngle(UP, angle)
}

/** Eye height above the agent's feet, by pose: lying in bed (or the hammock)
    the eyes are just above the surface; sitting on the floor or a chair they
    are lower than standing. */
export function povEyeHeight(pose: 'lie' | 'floor' | undefined, seated: boolean): number {
  if (pose === 'lie') return 0.75
  if (pose === 'floor' || seated) return 1.1
  return 1.55
}

/** The eye position and look target for an agent at `position` facing
    `heading` (rotation.y, where the face points along local +z). The camera
    sits at eye height and looks straight ahead, so it sees what the agent
    sees — including while they walk, since both update every frame. */
export function povView(position: THREE.Vector3, heading: number, eyeHeight: number): { eye: THREE.Vector3; target: THREE.Vector3 } {
  const eye = position.clone()
  eye.y += eyeHeight
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
  return { eye, target: eye.clone().add(forward) }
}
