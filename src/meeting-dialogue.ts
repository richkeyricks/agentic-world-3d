// Meeting dialogue: what ISA and Richkeyrick AI say while they are in a
// meeting together (both Collaborating on the same task). Pure functions of the
// task subject and Date.now(), like the street-life bubbles, so the 3D labels,
// the DOM bubbles and the tests all agree on the same schedule.
//
// Honest framing: both characters are run by ISA — Richkeyrick AI is the
// engineer role ISA plays, not a separate second AI. The lines are generated
// from the task itself (its title, in general terms), never from an LLM and
// never from the task detail, which may carry internal detail. There is no
// external AI service at runtime.

import type { OfficeStation } from './types.ts'

export type MeetingSpeaker = 'isa' | 'richkeyrick'
export interface MeetingExchange { speaker: MeetingSpeaker; line: string }

/** Each exchange speaks this long, then the table goes quiet until the next. */
export const MEETING_SPEAK_MS = 7_000
export const MEETING_STEP_MS = 10_000

// Activity labels that are NOT a task title — a meeting on one of these has
// no subject to talk about, so no dialogue is generated.
const NON_SUBJECTS = new Set([
  '',
  'No attributed task',
  'Not Available',
  'On a break',
  'On a break · gateway stopped',
  '🔒 Private',
])

/**
 * The shared subject of the ISA ↔ Richkeyrick AI meeting right now, or null.
 * A meeting exists only when both are Collaborating and their activity is the
 * same task title — the snapshot carries the title in `activity` for both
 * (their `currentTask` can differ: the board attributes the task to the agent
 * of its latest event only). The detail is never used: it may carry internal
 * detail, and the client never receives it anyway.
 */
export function meetingSubject(stations: Pick<OfficeStation, 'id' | 'state' | 'activity'>[]): string | null {
  const isa = stations.find((station) => station.id === 'isa')
  const richkeyrick = stations.find((station) => station.id === 'richkeyrick')
  if (!isa || !richkeyrick) return null
  if (isa.state !== 'Collaborating' || richkeyrick.state !== 'Collaborating') return null
  const subject = isa.activity.trim()
  if (!subject || subject !== richkeyrick.activity.trim()) return null
  if (NON_SUBJECTS.has(subject) || subject.startsWith('🔒')) return null
  return subject
}

// The subject as it appears in a bubble: one line, capped so a long title does
// not flood the 3D label. Cut at a word boundary where possible.
const SUBJECT_MAX = 64

function shortSubject(subject: string): string {
  const clean = subject.trim().replace(/\s+/g, ' ')
  if (clean.length <= SUBJECT_MAX) return clean
  const cut = clean.slice(0, SUBJECT_MAX - 3)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// Template families. ISA (the planner) always opens, Richkeyrick AI (the
// implementer) answers, and every line mentions the task subject — `{Subject}`
// at the start of a sentence, `{subject}` mid-sentence — so the exchange reads
// as a discussion of this task, not a canned line.
const TEMPLATE_FAMILIES: { speaker: MeetingSpeaker; text: string }[][] = [
  [
    { speaker: 'isa', text: 'Rencana {Subject}: kita kerjakan selangkah demi selangkah, ya.' },
    { speaker: 'richkeyrick', text: 'Siap — {subject} saya yang bangun, mulai dari strukturnya dulu.' },
    { speaker: 'isa', text: 'Bagus. Sebelum selesai, kita cek lagi {subject} sama-sama.' },
  ],
  [
    { speaker: 'isa', text: '{Subject} — langkah pertamanya apa dulu menurutmu?' },
    { speaker: 'richkeyrick', text: 'Saya mulai {subject} dari bagian yang paling penting, lalu kita uji.' },
  ],
  [
    { speaker: 'isa', text: 'Untuk {subject}, kita bagi jadi langkah kecil supaya gampang dicek.' },
    { speaker: 'richkeyrick', text: 'Oke, saya kerjakan {subject} — kalau ada yang mentok, saya kabari.' },
    { speaker: 'isa', text: 'Setuju. Nanti kita lihat hasil {subject} bareng-bareng.' },
  ],
  [
    { speaker: 'isa', text: 'Supaya {subject} rapi, kita sepakati dulu langkah-langkahnya.' },
    { speaker: 'richkeyrick', text: 'Setuju. Saya kerjakan {subject} sesuai langkah itu, lalu kita cek.' },
  ],
]

// FNV-1a over the subject, so a task always gets the same set and a different
// task usually gets a different one. Three-exchange families are sometimes cut
// to their first two lines, so the same family can still sound different.
function hashSubject(subject: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < subject.length; i++) {
    hash ^= subject.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The 2–3 exchanges for one task, deterministic from its title. */
export function meetingDialogue(subject: string): MeetingExchange[] {
  const clean = subject.trim()
  if (!clean || NON_SUBJECTS.has(clean) || clean.startsWith('🔒')) return []
  const short = shortSubject(clean)
  const start = short.charAt(0).toUpperCase() + short.slice(1)
  const mid = short.charAt(0).toLowerCase() + short.slice(1)
  const hash = hashSubject(clean)
  const family = TEMPLATE_FAMILIES[hash % TEMPLATE_FAMILIES.length]
  const lines = family.length === 3 && (hash >>> 2) % 2 === 1 ? family.slice(0, 2) : family
  return lines.map(({ speaker, text }) => ({
    speaker,
    line: text.replaceAll('{Subject}', start).replaceAll('{subject}', mid),
  }))
}

/** The exchange live right now during a meeting on this subject, or null in the quiet gap between exchanges. */
export function meetingLine(subject: string, now: number): MeetingExchange | null {
  const exchanges = meetingDialogue(subject)
  if (exchanges.length === 0) return null
  const cycle = exchanges.length * MEETING_STEP_MS
  const phase = ((now % cycle) + cycle) % cycle
  if (phase % MEETING_STEP_MS >= MEETING_SPEAK_MS) return null
  return exchanges[Math.floor(phase / MEETING_STEP_MS)]
}
