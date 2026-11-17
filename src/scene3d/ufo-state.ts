// UFO + alien abduction: the pure state machine, kept apart from the scene so it
// can be tested. A UFO occasionally appears, hovers over the street, drops a
// light beam, sends an alien down, lifts a pedestrian up into the ship, flies
// off — and comes back to drop the victim at a DIFFERENT place, like in the
// movies. The scene (ufo.tsx) drives this every frame from the clock and
// writes the abduction into a shared ref the walkers read; the machine itself
// never touches the DOM, the scene, or the network.
//
// One event, in order: idle → arrive (flies in, tracking the victim) → beam
// (beam down, alien descends, victim frozen) → lift (victim + alien rise up
// the beam) → carry (UFO flies off with the victim inside) → return (UFO
// flies back in at the drop point) → drop (victim lowered to the ground, alien
// rides back up) → leave (UFO flies off) → idle (random wait for the next).

import { GAME_ROOM, MARKET, type OfficeLayout } from '../office3d-layout.ts'

export type UfoVictimId = 'ped-0' | 'ped-1' | 'ped-2' | 'ricky'
export type UfoPhase = 'idle' | 'arrive' | 'beam' | 'lift' | 'carry' | 'return' | 'drop' | 'leave'

/** Height the UFO hovers at, above the victim. */
export const UFO_HOVER_Y = 14
/** Where the victim's feet stop on the way up: the UFO's belly. */
export const UFO_BEAM_TOP_Y = 12.5
/** The tractor beam, BLUE since Ricky chose it (2026-11-17): a saturated
    outer cone that reads against a bright day sky, a bright ice-cyan core,
    and a blue glow where it lands — so the beam is visible in daylight, not
    only at night. Opacities are the peak values; the machine fades them
    in/out via ufoBeam(). (Was pale green #a8ff9e before.) */
export const UFO_BEAM = {
  outer: '#2f7bff',
  core: '#55d5ff',
  glow: '#2f7bff',
  outerOpacity: 0.38,
  coreOpacity: 0.55,
  glowOpacity: 0.55,
} as const

/** How much stronger the beam renders in daylight than at night: the bright
    day sky washes a translucent beam out, so it gets a boost when the sun is
    up (night keeps the values above). 1.6x at full day, 1x at full night. */
export function beamOpacityScale(nightAmount: number): number {
  const t = Math.min(1, Math.max(0, nightAmount))
  return 1 + (1 - t) * 0.6
}
/** Seconds each phase lasts (idle is a wait, not a duration). */
export const UFO_PHASE_S: Record<UfoPhase, number> = {
  idle: 0, arrive: 4, beam: 3.5, lift: 3.5, carry: 3, return: 3.5, drop: 3.5, leave: 3,
}
/** First event after load, and the wait between events. */
export const UFO_FIRST_MIN_S = 25
export const UFO_FIRST_MAX_S = 45
export const UFO_GAP_MIN_S = 75
export const UFO_GAP_MAX_S = 150
/** A drop-off must be at least this far from where the victim was taken. */
export const UFO_MIN_DROP_DISTANCE = 8
/** Sidewalk lanes a dropped pedestrian can land on (eastbound / westbound). */
export const UFO_DROP_LANES_Z = [5.9, 7.0] as const
export const UFO_DROP_X_MIN = -12
export const UFO_DROP_X_MAX = 26

/** What the walkers do while the UFO has them. */
export type UfoAbductionPhase = 'frozen' | 'lift' | 'carried' | 'drop'
/** The shared abduction the UFO writes and the walkers read every frame. */
export interface UfoAbduction {
  victim: UfoVictimId
  phase: UfoAbductionPhase
  /** The victim's height above the ground while being lifted / lowered. */
  liftY: number
  dropX: number
  dropZ: number
}

/** What the UFO says, by phase — the bubble on its label. */
export const UFO_LINES: Record<UfoPhase, string | null> = {
  idle: null,
  arrive: '🛸 Ada yang aneh di langit...',
  beam: '👽 Kami datang dengan damai!',
  lift: '👽 Ikut kami sebentar ya~',
  carry: null,
  return: null,
  drop: '👽 Terima kasih sudah mampir!',
  leave: null,
}

export interface UfoState {
  phase: UfoPhase
  /** Clock time (s) the current phase started at. */
  phaseStart: number
  /** Clock time (s) the next event starts at (idle only). */
  nextAt: number
  victim: UfoVictimId | null
  /** The victim of the current (or just finished) event — kept after idle so
      the record of the event survives it. */
  lastVictim: UfoVictimId | null
  /** Hover point above the victim (arrive tracks them; beam locks it in). */
  hover: { x: number; z: number } | null
  /** Where the victim is dropped off. */
  drop: { x: number; z: number } | null
  /** The drop-off of the current (or just finished) event — kept after idle so
      the record of the event survives it (drop itself is cleared at idle). */
  lastDrop: { x: number; z: number } | null
  /** Clock time to freeze the lift at (holdLift only): the victim stays
      halfway up the beam. Null unless a lift hold is in progress. */
  liftFrozenAt: number | null
  /** Phases visited in the current (or just finished) event, in order. The
      machine maintains this as it advances, so a slow frame that spans two
      phases still records both. */
  history: UfoPhase[]
  /** Where the victim was taken from (hover when the beam locked on). */
  abductAt: { x: number; z: number } | null
}

const random = (min: number, max: number, rand: () => number) => min + rand() * (max - min)

/** A fresh machine, waiting for its first event. */
export function createUfoState(now: number, firstIn?: number, rand: () => number = Math.random): UfoState {
  return {
    phase: 'idle',
    phaseStart: now,
    nextAt: now + (firstIn ?? random(UFO_FIRST_MIN_S, UFO_FIRST_MAX_S, rand)),
    victim: null,
    lastVictim: null,
    hover: null,
    drop: null,
    lastDrop: null,
    liftFrozenAt: null,
    history: [],
    abductAt: null,
  }
}

/** A point inside the office, the game room or Ricky Market — no beam goes through a roof. */
export function isIndoors(x: number, z: number, layout: OfficeLayout): boolean {
  const { minX, maxX, minZ, maxZ } = layout.building
  if (x > minX && x < maxX && z > minZ && z < maxZ) return true
  if (x > GAME_ROOM.minX && x < GAME_ROOM.maxX && z > GAME_ROOM.minZ && z < GAME_ROOM.maxZ) return true
  if (x > MARKET.minX && x < MARKET.maxX && z > MARKET.minZ && z < MARKET.maxZ) return true
  return false
}

export interface UfoCandidate { id: UfoVictimId; x: number; z: number }

export function pickVictim(candidates: readonly UfoCandidate[], forced: UfoVictimId | null, rand: () => number = Math.random): UfoVictimId | null {
  if (candidates.length === 0) return null
  if (forced) {
    const match = candidates.find((item) => item.id === forced)
    if (match) return match.id
  }
  return candidates[Math.floor(rand() * candidates.length)].id
}

/** Where the victim is dropped: a different place, at least 8 m from where they
    were taken. Ricky lands on a waypoint of his own loop (so he resumes it
    from there); a pedestrian lands on a sidewalk lane. */
export function pickDropPoint(victim: UfoVictimId, at: { x: number; z: number }, loop: readonly [number, number][], rand: () => number = Math.random): { x: number; z: number } {
  const farEnough = (x: number, z: number) => Math.hypot(x - at.x, z - at.z) >= UFO_MIN_DROP_DISTANCE
  if (victim === 'ricky') {
    const far = loop.filter(([x, z]) => farEnough(x, z))
    const pick = far.length > 0 ? far[Math.floor(rand() * far.length)] : loop.reduce((best, point) => (Math.hypot(point[0] - at.x, point[1] - at.z) > Math.hypot(best[0] - at.x, best[1] - at.z) ? point : best), loop[0])
    return { x: pick[0], z: pick[1] }
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const x = random(UFO_DROP_X_MIN, UFO_DROP_X_MAX, rand)
    const z = UFO_DROP_LANES_Z[Math.floor(rand() * UFO_DROP_LANES_Z.length)]
    if (farEnough(x, z)) return { x, z }
  }
  // Fallback: the far end of the sidewalk from where they were taken.
  return { x: at.x < 7 ? UFO_DROP_X_MAX : UFO_DROP_X_MIN, z: 5.9 }
}

export interface UfoContext {
  candidates: readonly UfoCandidate[]
  pickDrop: (victim: UfoVictimId, at: { x: number; z: number }) => { x: number; z: number }
  forcedVictim?: UfoVictimId | null
  random?: () => number
  /** Verification only: freeze the event in the beam phase (for a still shot). */
  holdBeam?: boolean
  /** Verification only: freeze the event once the victim is halfway up the
      beam (for a still shot of the lift). */
  holdLift?: boolean
}

const NEXT_PHASE: Partial<Record<UfoPhase, UfoPhase>> = {
  arrive: 'beam', beam: 'lift', lift: 'carry', carry: 'return', return: 'drop', drop: 'leave',
}

/** Advance the machine to `now`. Pure except for the randomness at transitions
    (injected, so tests can fix it). Steps through as many phases as the elapsed
    time covers, so a slow frame never leaves it a phase behind — and records
    every phase it passes through, so the history is complete even then. A
    forced victim who is not around yet makes the machine wait for them instead
    of taking someone else (the hook is for verification; the wait is bounded
    by a market visit, ~20 s). */
export function stepUfo(state: UfoState, now: number, ctx: UfoContext): UfoState {
  const rand = ctx.random ?? Math.random
  let current = state
  for (let guard = 0; guard < 12; guard += 1) {
    if (current.phase === 'idle') {
      if (now < current.nextAt || ctx.candidates.length === 0) return current
      const victim = pickVictim(ctx.candidates, ctx.forcedVictim ?? null, rand)
      if (!victim) return current
      // Forced victim not around yet (indoors, in the market): wait for them.
      if (ctx.forcedVictim && victim !== ctx.forcedVictim) return current
      const at = ctx.candidates.find((item) => item.id === victim)!
      // The drop-off is picked when the beam locks on, not here: the victim
      // keeps walking during the fly-in, so a drop picked now could end up
      // closer than 8 m from where they are actually taken.
      return { ...current, phase: 'arrive', phaseStart: now, victim, lastVictim: victim, hover: { x: at.x, z: at.z }, drop: null, lastDrop: null, liftFrozenAt: null, history: ['arrive'], abductAt: null }
    }
    // While flying in, the UFO tracks its victim; once the beam locks on, the
    // hover point stays put (the victim is frozen from then on).
    if (current.phase === 'arrive' && current.victim) {
      const at = ctx.candidates.find((item) => item.id === current.victim)
      if (at) current = { ...current, hover: { x: at.x, z: at.z } }
    }
    const duration = UFO_PHASE_S[current.phase]
    if (now - current.phaseStart < duration) return current
    // Hold a phase for a still shot (verification only): the machine stops here
    // instead of advancing. This is checked inside the loop, so a slow frame
    // that jumps two phases still catches the held one. The beam hold freezes
    // at the end of the beam — the beam is at full opacity and the alien is on
    // the ground. The lift hold freezes the lift halfway (smooth(0.5) = 0.5, so
    // the victim is at 6.25 m): liftFrozenAt is the clock time to compute the
    // lift from, so the victim stays mid-beam instead of rising to the belly.
    if (current.phase === 'beam' && ctx.holdBeam) return current
    if (current.phase === 'lift' && ctx.holdLift) return { ...current, liftFrozenAt: current.phaseStart + UFO_PHASE_S.lift / 2 }
    const next = NEXT_PHASE[current.phase]
    if (!next) {
      // The event is over: back to idle, with a fresh random wait. The
      // history, last victim, abduction point and drop-off stay, as the record.
      return { ...current, phase: 'idle', phaseStart: now, nextAt: now + random(UFO_GAP_MIN_S, UFO_GAP_MAX_S, rand), victim: null, hover: null, drop: null }
    }
    const advanced: UfoState = { ...current, phase: next, phaseStart: current.phaseStart + duration, history: [...current.history, next] }
    if (next === 'beam' && current.hover && current.victim) {
      // The beam locks on here: this hover is where the victim is taken from,
      // so the drop-off is picked from it (at least 8 m away).
      advanced.abductAt = { ...current.hover }
      const drop = ctx.pickDrop(current.victim, current.hover)
      advanced.drop = drop
      advanced.lastDrop = drop
    }
    current = advanced
  }
  return current
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (t: number) => { const v = clamp01(t); return v * v * (3 - 2 * v) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Where the UFO is right now — null while idle (hidden). */
export function ufoPosition(state: UfoState, now: number): { x: number; y: number; z: number } | null {
  if (state.phase === 'idle' || !state.hover) return null
  const hover = { x: state.hover.x, y: UFO_HOVER_Y, z: state.hover.z }
  const elapsed = now - state.phaseStart
  switch (state.phase) {
    case 'arrive': {
      const e = smooth(elapsed / UFO_PHASE_S.arrive)
      return { x: lerp(hover.x + 25, hover.x, e), y: lerp(42, hover.y, e), z: lerp(hover.z - 18, hover.z, e) }
    }
    case 'beam':
    case 'lift':
      return hover
    case 'carry': {
      const e = smooth(elapsed / UFO_PHASE_S.carry)
      return { x: lerp(hover.x, hover.x - 30, e), y: lerp(hover.y, 45, e), z: lerp(hover.z, hover.z + 25, e) }
    }
    case 'return': {
      if (!state.drop) return hover
      const e = smooth(elapsed / UFO_PHASE_S.return)
      return { x: lerp(state.drop.x + 25, state.drop.x, e), y: lerp(42, hover.y, e), z: lerp(state.drop.z - 18, state.drop.z, e) }
    }
    case 'drop': {
      if (!state.drop) return hover
      return { x: state.drop.x, y: UFO_HOVER_Y, z: state.drop.z }
    }
    case 'leave': {
      if (!state.drop) return hover
      const e = smooth(elapsed / UFO_PHASE_S.leave)
      return { x: lerp(state.drop.x, state.drop.x - 30, e), y: lerp(hover.y, 45, e), z: lerp(state.drop.z, state.drop.z + 25, e) }
    }
    default:
      return hover
  }
}

/** The beam: visible while it is down (beam / lift / drop), fading in at the edges. */
export function ufoBeam(state: UfoState, now: number): { visible: boolean; opacity: number } {
  if (state.phase !== 'beam' && state.phase !== 'lift' && state.phase !== 'drop') return { visible: false, opacity: 0 }
  return { visible: true, opacity: Math.min(1, (now - state.phaseStart) / 0.5) }
}

/** The victim's height above the ground — null when they are not being lifted
    or lowered (on the ground, or hidden inside the UFO). */
export function victimLiftY(state: UfoState, now: number): number | null {
  const elapsed = now - state.phaseStart
  if (state.phase === 'lift') return smooth(elapsed / UFO_PHASE_S.lift) * UFO_BEAM_TOP_Y
  if (state.phase === 'drop') return (1 - smooth(elapsed / UFO_PHASE_S.drop)) * UFO_BEAM_TOP_Y
  if (state.phase === 'carry' || state.phase === 'return') return UFO_BEAM_TOP_Y
  return null
}

/** The alien's height above the ground — null while it stays in the ship. It
    rides down the beam, rises with the victim, rides back down for the
    drop-off, then hurries back up while the victim stays on the ground. */
export function alienY(state: UfoState, now: number): number | null {
  const elapsed = now - state.phaseStart
  if (state.phase === 'beam') return (1 - smooth(elapsed / UFO_PHASE_S.beam)) * UFO_BEAM_TOP_Y
  if (state.phase === 'lift') {
    const lift = victimLiftY(state, now)
    return lift === null ? null : lift + 0.3
  }
  if (state.phase === 'drop') {
    const lift = victimLiftY(state, now) ?? 0
    const t = elapsed / UFO_PHASE_S.drop
    if (t < 0.7) return lift + 0.3
    const from = (1 - smooth(0.7)) * UFO_BEAM_TOP_Y + 0.3
    return lerp(from, UFO_BEAM_TOP_Y, smooth((t - 0.7) / 0.3))
  }
  return null
}

/** What the victim should do right now — null when the UFO has no hold on them. */
export function abductionFor(state: UfoState): { victim: UfoVictimId; phase: UfoAbductionPhase } | null {
  if (!state.victim) return null
  switch (state.phase) {
    case 'beam': return { victim: state.victim, phase: 'frozen' }
    case 'lift': return { victim: state.victim, phase: 'lift' }
    case 'carry':
    case 'return': return { victim: state.victim, phase: 'carried' }
    case 'drop': return { victim: state.victim, phase: 'drop' }
    default: return null
  }
}
