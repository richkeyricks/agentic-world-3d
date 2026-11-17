import { describe, expect, it } from 'vitest'
import { createLayout } from '../office3d-layout.ts'
import { promoterLoop } from './promoter-route.ts'
import {
  UFO_BEAM,
  UFO_BEAM_TOP_Y,
  UFO_HOVER_Y,
  UFO_MIN_DROP_DISTANCE,
  UFO_PHASE_S,
  abductionFor,
  alienY,
  beamOpacityScale,
  createUfoState,
  isIndoors,
  pickDropPoint,
  pickVictim,
  stepUfo,
  ufoBeam,
  ufoPosition,
  victimLiftY,
  type UfoCandidate,
  type UfoState,
} from './ufo-state.ts'

const CANDIDATES: UfoCandidate[] = [
  { id: 'ped-0', x: -8, z: 5.9 },
  { id: 'ped-1', x: 6, z: 7.0 },
  { id: 'ped-2', x: 18, z: 5.9 },
  { id: 'ricky', x: 2, z: 5.9 },
]
const LOOP = promoterLoop(createLayout(7))
const ctx = (candidates: readonly UfoCandidate[] = CANDIDATES, forced: 'ricky' | 'ped-0' | null = null) => ({
  candidates,
  forcedVictim: forced,
  pickDrop: (victim: 'ped-0' | 'ped-1' | 'ped-2' | 'ricky', at: { x: number; z: number }) => pickDropPoint(victim, at, LOOP, () => 0.5),
  random: () => 0.5,
})

/** Step the machine to `now` from a state, with the same candidates. */
function at(state: UfoState, now: number, forced: 'ricky' | 'ped-0' | null = null): UfoState {
  return stepUfo(state, now, ctx(CANDIDATES, forced))
}

describe('createUfoState', () => {
  it('starts idle, with the first event 25–45 s out', () => {
    const state = createUfoState(0)
    expect(state.phase).toBe('idle')
    expect(state.nextAt).toBeGreaterThanOrEqual(25)
    expect(state.nextAt).toBeLessThanOrEqual(45)
    expect(state.victim).toBeNull()
  })

  it('honours a fixed first-in time', () => {
    expect(createUfoState(10, 3).nextAt).toBe(13)
  })
})

describe('stepUfo', () => {
  it('stays idle before the next event, and with no candidates at all', () => {
    const state = createUfoState(0, 3)
    expect(at(state, 2).phase).toBe('idle')
    expect(stepUfo(state, 5, ctx([])).phase).toBe('idle')
  })

  it('starts an event at nextAt: arrive, with a victim and a hover above them; the drop is picked when the beam locks on', () => {
    const started = at(createUfoState(0, 3), 3)
    expect(started.phase).toBe('arrive')
    expect(started.victim).not.toBeNull()
    const victim = CANDIDATES.find((item) => item.id === started.victim)!
    expect(started.hover).toEqual({ x: victim.x, z: victim.z })
    // No drop-off yet: the victim is still walking during the fly-in.
    expect(started.drop).toBeNull()
    const beamed = at(started, 3 + UFO_PHASE_S.arrive)
    expect(beamed.phase).toBe('beam')
    expect(beamed.drop).not.toBeNull()
    expect(Math.hypot(beamed.drop!.x - beamed.abductAt!.x, beamed.drop!.z - beamed.abductAt!.z)).toBeGreaterThanOrEqual(UFO_MIN_DROP_DISTANCE)
  })

  it('walks the phases in order — arrive, beam, lift, carry, return, drop, leave, idle', () => {
    let state = at(createUfoState(0, 3), 3)
    const seen: string[] = [state.phase]
    let now = 3
    for (let step = 0; step < 12; step += 1) {
      const duration = UFO_PHASE_S[state.phase as keyof typeof UFO_PHASE_S]
      now += duration
      state = at(state, now)
      seen.push(state.phase)
      if (state.phase === 'idle') break
    }
    expect(seen).toEqual(['arrive', 'beam', 'lift', 'carry', 'return', 'drop', 'leave', 'idle'])
    // The event is over: no victim, and the next event is 75–150 s out.
    expect(state.victim).toBeNull()
    expect(state.nextAt).toBeGreaterThanOrEqual(now + 75)
    expect(state.nextAt).toBeLessThanOrEqual(now + 150)
  })

  it('catches up several phases at once after a slow frame', () => {
    const state = at(createUfoState(0, 3), 3)
    // 4 + 3.5 + 3.5 s of phases in one jump: arrive, beam and lift are all done.
    expect(at(state, 3 + 4 + 3.5 + 3.5).phase).toBe('carry')
  })

  it('records every phase it passes through, even when a slow frame jumps two at once', () => {
    const state = at(createUfoState(0, 3), 3)
    // One jump over arrive + beam + lift + carry: the history still lists them all.
    const jumped = at(state, 3 + 4 + 3.5 + 3.5 + 3)
    expect(jumped.phase).toBe('return')
    expect(jumped.history).toEqual(['arrive', 'beam', 'lift', 'carry', 'return'])
    // And the full event's history is complete at the end.
    const done = at(state, 3 + 4 + 3.5 + 3.5 + 3 + 3.5 + 3.5 + 3)
    expect(done.phase).toBe('idle')
    expect(done.history).toEqual(['arrive', 'beam', 'lift', 'carry', 'return', 'drop', 'leave'])
  })

  it('records where the victim was taken from when the beam locks on, and keeps the record after idle', () => {
    let state = at(createUfoState(0, 3), 3)
    expect(state.abductAt).toBeNull()
    state = at(state, 3 + UFO_PHASE_S.arrive)
    expect(state.phase).toBe('beam')
    expect(state.abductAt).toEqual(state.hover)
    const victim = state.lastVictim
    expect(victim).toBe(state.victim)
    state = at(state, 3 + 4 + 3.5 + 3.5 + 3 + 3.5 + 3.5 + 3)
    expect(state.phase).toBe('idle')
    expect(state.victim).toBeNull()
    expect(state.lastVictim).toBe(victim)
    expect(state.history).toEqual(['arrive', 'beam', 'lift', 'carry', 'return', 'drop', 'leave'])
    expect(state.abductAt).not.toBeNull()
  })

  it('tracks the victim while flying in, then locks the hover when the beam starts', () => {
    let state = at(createUfoState(0, 3), 3)
    const moved = CANDIDATES.map((item) => (item.id === state.victim ? { ...item, x: item.x + 4 } : item))
    state = stepUfo(state, 5, ctx(moved))
    expect(state.hover!.x).toBeCloseTo((moved.find((item) => item.id === state.victim)!.x))
    // Once the beam is on, the hover no longer follows the victim.
    state = at(state, 3 + UFO_PHASE_S.arrive)
    expect(state.phase).toBe('beam')
    const locked = state.hover
    const movedAgain = moved.map((item) => (item.id === state.victim ? { ...item, x: item.x + 4 } : item))
    state = stepUfo(state, 8, ctx(movedAgain))
    expect(state.hover).toEqual(locked)
  })

  it('honours a forced victim when they are among the candidates', () => {
    const state = at(createUfoState(0, 3), 3, 'ricky')
    expect(state.victim).toBe('ricky')
    // A forced victim who is not around falls back to a random one.
    const withoutRicky = at(createUfoState(0, 3), 3, 'ped-0')
    expect(withoutRicky.victim).toBe('ped-0')
  })

  it('waits for a forced victim who is indoors instead of taking someone else', () => {
    // Ricky is in the market (not a candidate): the machine stays idle...
    const withoutRicky = CANDIDATES.filter((item) => item.id !== 'ricky')
    const waiting = stepUfo(createUfoState(0, 3), 5, ctx(withoutRicky, 'ricky'))
    expect(waiting.phase).toBe('idle')
    expect(waiting.victim).toBeNull()
    // ...and starts with Ricky the moment he steps back out.
    const started = stepUfo(waiting, 6, ctx(CANDIDATES, 'ricky'))
    expect(started.phase).toBe('arrive')
    expect(started.victim).toBe('ricky')
  })

  it('freezes in the beam when holdBeam is set, even when a slow frame jumps two phases', () => {
    const held = stepUfo(createUfoState(0, 3), 3, { ...ctx(CANDIDATES, 'ricky'), holdBeam: true })
    // Jump far past the beam in one call: the machine still stops in the beam.
    const frozen = stepUfo(held, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + 10, { ...ctx(CANDIDATES, 'ricky'), holdBeam: true })
    expect(frozen.phase).toBe('beam')
    expect(frozen.victim).toBe('ricky')
    // Without the hold the same jump sails through to the end of the event.
    const free = at(createUfoState(0, 3), 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + 10, 'ricky')
    expect(free.phase).not.toBe('beam')
  })

  it('freezes the lift halfway when holdLift is set, with the victim mid-beam', () => {
    const started = at(createUfoState(0, 3), 3, 'ricky')
    // Jump far past the lift in one call: the machine stops in the lift...
    const frozen = stepUfo(started, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift + 10, { ...ctx(CANDIDATES, 'ricky'), holdLift: true })
    expect(frozen.phase).toBe('lift')
    expect(frozen.liftFrozenAt).toBe(started.phaseStart + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift / 2)
    // ...and the lift computed from the frozen time is halfway up (6.25 m).
    expect(victimLiftY(frozen, frozen.liftFrozenAt!)).toBeCloseTo(UFO_BEAM_TOP_Y / 2, 5)
    // It stays frozen on later calls, and the beam is still down there.
    const still = stepUfo(frozen, 100, { ...ctx(CANDIDATES, 'ricky'), holdLift: true })
    expect(still.phase).toBe('lift')
    expect(ufoBeam(still, still.liftFrozenAt!).visible).toBe(true)
  })

  it('picks the drop-off from where the victim is actually taken, and keeps it in the record', () => {
    const started = at(createUfoState(0, 3), 3, 'ricky')
    // No drop-off yet: the victim is still walking during the fly-in.
    expect(started.drop).toBeNull()
    expect(started.lastDrop).toBeNull()
    // Once the beam locks on, the drop is picked from the abduction point.
    const beamed = at(started, 3 + UFO_PHASE_S.arrive)
    expect(beamed.phase).toBe('beam')
    expect(beamed.abductAt).not.toBeNull()
    expect(beamed.drop).not.toBeNull()
    expect(beamed.lastDrop).toEqual(beamed.drop)
    expect(Math.hypot(beamed.lastDrop!.x - beamed.abductAt!.x, beamed.lastDrop!.z - beamed.abductAt!.z)).toBeGreaterThanOrEqual(UFO_MIN_DROP_DISTANCE)
    // After the event the drop-off itself is cleared but the record stays.
    const done = at(beamed, 3 + 4 + 3.5 + 3.5 + 3 + 3.5 + 3.5 + 3)
    expect(done.phase).toBe('idle')
    expect(done.drop).toBeNull()
    expect(done.lastDrop).toEqual(beamed.lastDrop)
  })
})

describe('pickVictim', () => {
  it('returns null with no candidates, and a candidate otherwise', () => {
    expect(pickVictim([], null)).toBeNull()
    expect(CANDIDATES.map((item) => item.id)).toContain(pickVictim(CANDIDATES, null, () => 0))
    expect(pickVictim(CANDIDATES, 'ricky')).toBe('ricky')
  })
})

describe('pickDropPoint', () => {
  it('drops Ricky on a waypoint of his own loop, far from where he was taken', () => {
    const at = { x: 2, z: 5.9 }
    for (const rand of [0, 0.25, 0.5, 0.75, 0.99]) {
      const drop = pickDropPoint('ricky', at, LOOP, () => rand)
      expect(LOOP).toContainEqual([drop.x, drop.z])
      expect(Math.hypot(drop.x - at.x, drop.z - at.z)).toBeGreaterThanOrEqual(UFO_MIN_DROP_DISTANCE)
    }
  })

  it('drops a pedestrian on a sidewalk lane, far from where they were taken', () => {
    const at = { x: -8, z: 5.9 }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const drop = pickDropPoint('ped-0', at, LOOP, Math.random)
      expect([5.9, 7.0]).toContain(drop.z)
      expect(drop.x).toBeGreaterThanOrEqual(-12)
      expect(drop.x).toBeLessThanOrEqual(26)
      expect(Math.hypot(drop.x - at.x, drop.z - at.z)).toBeGreaterThanOrEqual(UFO_MIN_DROP_DISTANCE)
    }
  })
})

describe('isIndoors', () => {
  it('keeps the beam off roofs: the office, the market and the game room are indoors', () => {
    const layout = createLayout(7)
    expect(isIndoors(0, 0, layout)).toBe(true)
    expect(isIndoors(23, 0, layout)).toBe(true)
    expect(isIndoors(12, -2, layout)).toBe(true)
    expect(isIndoors(0, 5.9, layout)).toBe(false)
    expect(isIndoors(0, 12, layout)).toBe(false)
    expect(isIndoors(0, -6.3, layout)).toBe(false)
  })
})

describe('ufoPosition', () => {
  it('is null while idle, at the hover during beam and lift, and leaves far away', () => {
    const idle = createUfoState(0, 3)
    expect(ufoPosition(idle, 2)).toBeNull()
    let state = at(idle, 3)
    const hover = state.hover!
    // At the end of the flight in it sits exactly above the victim.
    expect(ufoPosition(state, 3 + UFO_PHASE_S.arrive)).toEqual({ x: hover.x, y: UFO_HOVER_Y, z: hover.z })
    state = at(state, 3 + UFO_PHASE_S.arrive)
    expect(ufoPosition(state, 8)).toEqual({ x: hover.x, y: UFO_HOVER_Y, z: hover.z })
    // By the end of the carry it is high and far from the hover point.
    const carried = at(state, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift + UFO_PHASE_S.carry)
    const gone = ufoPosition(carried, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift + UFO_PHASE_S.carry)!
    expect(gone.y).toBeGreaterThan(40)
    expect(Math.hypot(gone.x - hover.x, gone.z - hover.z)).toBeGreaterThan(20)
  })
})

describe('ufoBeam', () => {
  it('is down during beam, lift and drop only, fading in at the start', () => {
    let state = at(createUfoState(0, 3), 3)
    expect(ufoBeam(state, 4)).toEqual({ visible: false, opacity: 0 })
    state = at(state, 3 + UFO_PHASE_S.arrive)
    expect(ufoBeam(state, 7.1).visible).toBe(true)
    expect(ufoBeam(state, 7.1).opacity).toBeLessThan(1)
    expect(ufoBeam(state, 7.6).opacity).toBe(1)
    state = at(state, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift)
    expect(ufoBeam(state, 14).visible).toBe(false)
  })
})

describe('victimLiftY', () => {
  it('rises from the ground to the belly during lift, and back down during drop', () => {
    let state = at(createUfoState(0, 3), 3)
    state = at(state, 3 + UFO_PHASE_S.arrive)
    const liftStart = 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam
    state = at(state, liftStart)
    expect(victimLiftY(state, liftStart)).toBeCloseTo(0)
    expect(victimLiftY(state, liftStart + UFO_PHASE_S.lift / 2)).toBeGreaterThan(4)
    expect(victimLiftY(state, liftStart + UFO_PHASE_S.lift)).toBeCloseTo(UFO_BEAM_TOP_Y)
    const dropStart = liftStart + UFO_PHASE_S.lift + UFO_PHASE_S.carry + UFO_PHASE_S.return
    state = at(state, dropStart)
    expect(state.phase).toBe('drop')
    expect(victimLiftY(state, dropStart)).toBeCloseTo(UFO_BEAM_TOP_Y)
    expect(victimLiftY(state, dropStart + UFO_PHASE_S.drop)).toBeCloseTo(0)
  })

  it('is null on the ground and inside the ship', () => {
    const idle = createUfoState(0, 3)
    expect(victimLiftY(idle, 2)).toBeNull()
    const state = at(idle, 3)
    expect(victimLiftY(state, 4)).toBeNull()
  })
})

describe('alienY', () => {
  it('rides down the beam, up with the victim, and back up after the drop-off', () => {
    let state = at(createUfoState(0, 3), 3)
    state = at(state, 3 + UFO_PHASE_S.arrive)
    const beamStart = 3 + UFO_PHASE_S.arrive
    expect(alienY(state, beamStart)).toBeCloseTo(UFO_BEAM_TOP_Y)
    expect(alienY(state, beamStart + UFO_PHASE_S.beam)).toBeCloseTo(0)
    const liftStart = beamStart + UFO_PHASE_S.beam
    state = at(state, liftStart)
    expect(alienY(state, liftStart)).toBeCloseTo(0.3)
    expect(alienY(state, liftStart + UFO_PHASE_S.lift)).toBeCloseTo(UFO_BEAM_TOP_Y + 0.3)
    const dropStart = liftStart + UFO_PHASE_S.lift + UFO_PHASE_S.carry + UFO_PHASE_S.return
    state = at(state, dropStart)
    expect(state.phase).toBe('drop')
    expect(alienY(state, dropStart)).toBeCloseTo(UFO_BEAM_TOP_Y + 0.3)
    expect(alienY(state, dropStart + UFO_PHASE_S.drop * 0.5)).toBeLessThan(8)
    expect(alienY(state, dropStart + UFO_PHASE_S.drop)).toBeCloseTo(UFO_BEAM_TOP_Y)
  })

  it('stays in the ship while it flies off and comes back', () => {
    let state = at(createUfoState(0, 3), 3)
    const carryStart = 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift
    state = at(state, carryStart)
    expect(state.phase).toBe('carry')
    expect(alienY(state, carryStart + 1)).toBeNull()
  })
})

describe('abductionFor', () => {
  it('maps the UFO phase to what the victim does', () => {
    let state = at(createUfoState(0, 3), 3)
    expect(abductionFor(state)).toBeNull()
    state = at(state, 3 + UFO_PHASE_S.arrive)
    expect(abductionFor(state)).toEqual({ victim: state.victim, phase: 'frozen' })
    state = at(state, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam)
    expect(abductionFor(state)).toEqual({ victim: state.victim, phase: 'lift' })
    state = at(state, 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift)
    expect(abductionFor(state)).toEqual({ victim: state.victim, phase: 'carried' })
    const dropStart = 3 + UFO_PHASE_S.arrive + UFO_PHASE_S.beam + UFO_PHASE_S.lift + UFO_PHASE_S.carry + UFO_PHASE_S.return
    state = at(state, dropStart)
    expect(abductionFor(state)).toEqual({ victim: state.victim, phase: 'drop' })
    state = at(state, dropStart + UFO_PHASE_S.drop + UFO_PHASE_S.leave)
    expect(abductionFor(state)).toBeNull()
    expect(state.phase).toBe('idle')
  })
})

/** The beam palette: blue since Ricky chose it (2026-11-17), so it reads in daylight. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

describe('UFO_BEAM', () => {
  it('is blue, not the old pale green', () => {
    for (const color of [UFO_BEAM.outer, UFO_BEAM.core, UFO_BEAM.glow]) {
      expect(color).not.toBe('#a8ff9e')
      const [r, g, b] = rgb(color)
      expect(b).toBeGreaterThan(r)
      expect(b).toBeGreaterThanOrEqual(g)
    }
  })

  it('has a bright core that stands out against a bright day sky', () => {
    const [rOuter, gOuter, bOuter] = rgb(UFO_BEAM.outer)
    const [rCore, gCore, bCore] = rgb(UFO_BEAM.core)
    const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
    expect(luminance([rCore, gCore, bCore])).toBeGreaterThan(luminance([rOuter, gOuter, bOuter]))
    expect(UFO_BEAM.coreOpacity).toBeGreaterThan(UFO_BEAM.outerOpacity)
  })

  it('keeps every opacity in range', () => {
    for (const opacity of [UFO_BEAM.outerOpacity, UFO_BEAM.coreOpacity, UFO_BEAM.glowOpacity]) {
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })
})

describe('beamOpacityScale', () => {
  it('boosts the beam in daylight and leaves the night values alone', () => {
    expect(beamOpacityScale(0)).toBeCloseTo(1.6)
    expect(beamOpacityScale(1)).toBeCloseTo(1)
    expect(beamOpacityScale(0.5)).toBeCloseTo(1.3)
  })

  it('clamps out-of-range input', () => {
    expect(beamOpacityScale(-2)).toBeCloseTo(1.6)
    expect(beamOpacityScale(5)).toBeCloseTo(1)
  })
})
