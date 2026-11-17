import { describe, expect, it } from 'vitest'
import { MEETING_SPEAK_MS, MEETING_STEP_MS, meetingDialogue, meetingLine, meetingSubject } from './meeting-dialogue.ts'
import type { OfficeStation } from './types.ts'

const station = (overrides: Partial<OfficeStation>): OfficeStation => ({
  id: 'isa', name: 'ISA', role: 'Chief Orchestrator', room: 'Workspace', roomPosition: 'meeting-area',
  state: 'Collaborating', currentTask: 'Dialog meeting ISA dan Richkeyrick AI per task',
  recentActivity: '', activity: 'Dialog meeting ISA dan Richkeyrick AI per task', seat: 1, provenance: '', freshness: '',
  ...overrides,
})

describe('meetingDialogue', () => {
  it('produces 2–3 exchanges per task', () => {
    for (const subject of [
      'Dialog meeting ISA dan Richkeyrick AI per task',
      'Tampilan publik jadi default',
      'Orang promosi Ricky keliling kantor 3D',
      'Counter penonton live di header',
      'Tombol rotate di mobile',
      'Mode POV karakter',
      'UFO + alien',
    ]) {
      const exchanges = meetingDialogue(subject)
      expect(exchanges.length).toBeGreaterThanOrEqual(2)
      expect(exchanges.length).toBeLessThanOrEqual(3)
    }
  })

  it('alternates ISA (planner) and Richkeyrick AI (implementer), ISA first', () => {
    const exchanges = meetingDialogue('Tampilan publik jadi default')
    expect(exchanges[0].speaker).toBe('isa')
    for (let i = 1; i < exchanges.length; i++) {
      expect(exchanges[i].speaker).not.toBe(exchanges[i - 1].speaker)
    }
    expect(new Set(exchanges.map((item) => item.speaker))).toEqual(new Set(['isa', 'richkeyrick']))
  })

  it('is deterministic for the same task', () => {
    expect(meetingDialogue('Orang promosi Ricky keliling kantor 3D'))
      .toEqual(meetingDialogue('Orang promosi Ricky keliling kantor 3D'))
  })

  it('gives a different set for a different task', () => {
    const first = meetingDialogue('Dialog meeting ISA dan Richkeyrick AI per task')
    const second = meetingDialogue('Tampilan publik jadi default')
    expect(second).not.toEqual(first)
  })

  it('references the task subject in every line', () => {
    const subject = 'Tampilan publik jadi default'
    for (const { line } of meetingDialogue(subject)) {
      expect(line.toLowerCase()).toContain(subject.toLowerCase().slice(0, 24))
    }
  })

  it('returns nothing for a non-subject', () => {
    for (const subject of ['', 'No attributed task', 'On a break', 'Not Available', '🔒 Private']) {
      expect(meetingDialogue(subject)).toEqual([])
    }
  })

  it('shortens a very long title instead of flooding the bubble', () => {
    const long = 'Tugas yang judulnya sangat panjang sekali sampai melebihi batas wajar untuk sebuah bubble di kantor 3D'
    const lines = meetingDialogue(long)
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const { line } of lines) expect(line).not.toContain(long)
  })
})

describe('meetingLine', () => {
  const subject = 'Tampilan publik jadi default' // 2 exchanges: ISA, then Richkeyrick AI
  const exchanges = meetingDialogue(subject)

  it('starts with ISA, then goes quiet, then Richkeyrick AI answers', () => {
    expect(meetingLine(subject, 0)).toEqual(exchanges[0])
    expect(exchanges[0].speaker).toBe('isa')
    expect(meetingLine(subject, MEETING_SPEAK_MS)).toBeNull()
    expect(meetingLine(subject, MEETING_STEP_MS)).toEqual(exchanges[1])
    expect(exchanges[1].speaker).toBe('richkeyrick')
  })

  it('repeats the exchanges while the task runs', () => {
    const cycle = exchanges.length * MEETING_STEP_MS
    expect(meetingLine(subject, cycle)).toEqual(exchanges[0])
    expect(meetingLine(subject, cycle + MEETING_STEP_MS)).toEqual(exchanges[1])
  })

  it('returns nothing without a subject', () => {
    expect(meetingLine('On a break', 0)).toBeNull()
  })
})

describe('meetingSubject', () => {
  const isa = (overrides: Partial<OfficeStation> = {}) => station({ id: 'isa', ...overrides })
  const richkeyrick = (overrides: Partial<OfficeStation> = {}) => station({ id: 'richkeyrick', activity: 'Dialog meeting ISA dan Richkeyrick AI per task', currentTask: 'Dialog meeting ISA dan Richkeyrick AI per task', ...overrides })

  it('returns the shared task title while both are Collaborating', () => {
    expect(meetingSubject([isa(), richkeyrick()])).toBe('Dialog meeting ISA dan Richkeyrick AI per task')
  })

  it('returns null when either one is not Collaborating', () => {
    expect(meetingSubject([isa(), richkeyrick({ state: 'Working' })])).toBeNull()
    expect(meetingSubject([isa({ state: 'Idle', activity: 'On a break' }), richkeyrick()])).toBeNull()
  })

  it('returns null when they are on different tasks', () => {
    expect(meetingSubject([isa(), richkeyrick({ activity: 'Tampilan publik jadi default' })])).toBeNull()
  })

  it('returns null for a non-subject activity', () => {
    expect(meetingSubject([isa({ activity: 'On a break' }), richkeyrick({ activity: 'On a break' })])).toBeNull()
    expect(meetingSubject([isa({ activity: 'No attributed task' }), richkeyrick({ activity: 'No attributed task' })])).toBeNull()
  })

  it('returns null when either agent is missing', () => {
    expect(meetingSubject([isa()])).toBeNull()
    expect(meetingSubject([])).toBeNull()
  })
})
