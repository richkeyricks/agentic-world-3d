// Street life: canned lines and timing for the street characters (beggar, busker,
// vendors, guard) and for the snack exchanges at the food stalls. Pure functions of
// Date.now(), so the 3D gesture, the DOM bubbles and the tests all agree on the
// same schedule. Nothing here fetches anything.

import { IDLE_STOP_MS } from './office3d-layout.ts'

export type StreetKey = 'pengemis' | 'pengamen' | 'bakso' | 'cilok' | 'nasgor' | 'penyet' | 'kopi' | 'satpam'

export const STREET_NAMES: Record<StreetKey, string> = {
  pengemis: 'Pengemis',
  pengamen: 'Pengamen Anto',
  bakso: 'Dinov Safdijal',
  cilok: 'Andi Masta',
  nasgor: 'Tejo',
  penyet: 'Bejo',
  kopi: 'Moko',
  satpam: 'Satpam',
}

// Every seller now has a personal name on the label; the product stays visible as
// a small subtitle under it (and in their call-outs).
export const STREET_PRODUCT: Partial<Record<StreetKey, string>> = {
  bakso: 'Bakso',
  cilok: 'Cilok',
  nasgor: 'Nasi Goreng',
  penyet: 'Ayam Penyet',
  kopi: 'Kopi',
}

export const STREET_KEYS: StreetKey[] = ['bakso', 'cilok', 'nasgor', 'penyet', 'kopi', 'pengamen', 'pengemis', 'satpam']

const CALLOUTS: Partial<Record<StreetKey, string[]>> = {
  bakso: ['Bakso Malang, saya Dinov!', 'Bakso panas, kuahnya segar!'],
  cilok: ['Cilok kenyal, saya Andi!', 'Cilok lima ratusan, ayo dibeli!'],
  nasgor: ['Nasi goreng, saya Tejo!', 'Nasgor telur, ayo dicoba!'],
  penyet: ['Ayam penyet, saya Bejo!', 'Penyet panas, nasinya pulen!'],
  kopi: ['Kopi, saya Moko!', 'Kopi panas, kopi es!'],
  pengamen: ['🎵 Lagu lama, buat yang rindu...', 'Minta duitnya, Bang...', '🎵 Terima kasih, kawan!', 'Hidup jadi WNI oooh... rasanya Seperti di Neraka... Kasihanilah Aku..uuu..uu'],
  satpam: ['Selamat pagi, silakan masuk!', 'Parkirnya rapi ya, Pak!', 'Aman, terkendali!'],
}

// Each character calls out for 6 s in every 24 s, staggered so the street is never
// all quiet and never all talking at once.
const CALL_CYCLE_MS = 24_000
const CALL_SPEAK_MS = 6_000
const CALL_STAGGER_MS = 6_000
const CALL_KEYS: StreetKey[] = ['bakso', 'cilok', 'nasgor', 'penyet', 'kopi', 'pengamen', 'satpam']

/** The line a street character is saying right now, or null while quiet. */
export function streetLine(key: StreetKey, now: number): string | null {
  if (key === 'pengemis') return beggarLine(now)
  const lines = CALLOUTS[key]
  if (!lines) return null
  const index = CALL_KEYS.indexOf(key)
  const phase = (now + index * CALL_STAGGER_MS) % CALL_CYCLE_MS
  if (phase >= CALL_SPEAK_MS) return null
  return lines[Math.floor(now / CALL_CYCLE_MS) % lines.length]
}

// The beggar dances in place and begs on a 10 s loop: cup out with "Mohon
// sumbangan..." for the first 3 s, then a thank-you as if someone dropped a coin,
// then quiet. The 3D gesture uses the same phase (see beggarGesture).
export const BEGGAR_CYCLE_MS = 10_000
export const BEGGAR_BEG_MS = 3_000
export const BEGGAR_THANKS_MS = 6_500
export const BEGGAR_BEG_LINE = 'Mohon sumbangan...'
export const BEGGAR_THANKS_LINE = 'Terima kasih, semoga lancar rezekinya!'

export function beggarLine(now: number): string | null {
  const phase = now % BEGGAR_CYCLE_MS
  if (phase < BEGGAR_BEG_MS) return BEGGAR_BEG_LINE
  if (phase >= 4_000 && phase < BEGGAR_THANKS_MS) return BEGGAR_THANKS_LINE
  return null
}

/** How far the beggar is into his begging gesture (0 = resting, 1 = cup fully out). */
export function beggarGesture(now: number): number {
  const phase = now % BEGGAR_CYCLE_MS
  if (phase >= BEGGAR_BEG_MS) return 0
  return Math.min(Math.min(1, phase / 500), Math.min(1, (BEGGAR_BEG_MS - phase) / 500))
}

// Ricky the promoter: a scene character (not an agent) who walks around the
// office and Ricky Market. Four different bubbles cycling, two per theme:
// follow/subscribe Richkeyrick everywhere, and use RMP music for content.
export const PROMOTER_LINES = [
  '📺 Follow Richkeyrick di YouTube, Instagram, TikTok & Facebook ya!',
  '🔔 Subscribe Richkeyrick di semua medsos — www.richkeyrick.com!',
  '🎵 Buat konten pakai musik RMP — lagu asli anak Aceh, Indonesia!',
  '🎶 Musik RMP cuma Rp300rb/lagu, promo 10 orang pertama! WA 0852-6011-3313',
]
const PROMOTER_CYCLE_MS = 10_000
const PROMOTER_SPEAK_MS = 7_000

/** The line Ricky the promoter is saying right now, or null while quiet. */
export function promoterLine(now: number): string | null {
  const phase = now % PROMOTER_CYCLE_MS
  if (phase >= PROMOTER_SPEAK_MS) return null
  return PROMOTER_LINES[Math.floor(now / PROMOTER_CYCLE_MS) % PROMOTER_LINES.length]
}

// Snack exchanges at the food stalls: a customer orders, the vendor answers.
// Shown while an agent (or the buyer on the motorcycle) is at the stall, in the
// exchange window — the first part of the stop, once the customer has arrived.
export const FOOD_STALLS = ['bakso', 'kopi', 'cilok', 'nasgor', 'penyet'] as const
export type FoodStall = (typeof FOOD_STALLS)[number]
const EXCHANGE_START_MS = 8_000
const EXCHANGE_END_MS = 20_000

export function inExchangeWindow(now: number): boolean {
  const phase = now % IDLE_STOP_MS
  return phase >= EXCHANGE_START_MS && phase < EXCHANGE_END_MS
}

const EXCHANGES: Record<FoodStall, { agent: string; vendor: string }[]> = {
  bakso: [
    { agent: 'Baksonya satu, Bang!', vendor: 'Siap, mantap!' },
    { agent: 'Bakso urat, pedas ya!', vendor: 'Siap, langsung dibuat!' },
  ],
  kopi: [
    { agent: 'Kopinya satu, Bang!', vendor: 'Siap, panas apa es?' },
    { agent: 'Kopi hitam satu!', vendor: 'Siap, langsung diseduh!' },
  ],
  cilok: [
    { agent: 'Ciloknya sepuluh ribu, Bang!', vendor: 'Siap, ditunggu sebentar!' },
    { agent: 'Cilok pedas satu, Bang!', vendor: 'Siap, mantap!' },
  ],
  nasgor: [
    { agent: 'Nasi goreng satu, Bang!', vendor: 'Siap, panas-panas!' },
    { agent: 'Nasgor telur dua ya!', vendor: 'Oke, langsung digoreng!' },
  ],
  penyet: [
    { agent: 'Ayam penyet satu, Bang!', vendor: 'Siap, sambalnya dipisah?' },
    { agent: 'Penyetnya satu, nasinya tambah!', vendor: 'Siap, mantap!' },
  ],
}

/** The order + reply for a stall right now (rotates each stop); null for a non-stall. */
export function exchangeLines(stall: string, now: number): { agent: string; vendor: string } | null {
  const lines = (EXCHANGES as Record<string, { agent: string; vendor: string }[]>)[stall]
  if (!lines) return null
  return lines[Math.floor(now / IDLE_STOP_MS) % lines.length]
}

/** The exchange at a stall, but only while the exchange window is open. */
export function exchangeFor(stall: string, now: number): { agent: string; vendor: string } | null {
  if (!inExchangeWindow(now)) return null
  return exchangeLines(stall, now)
}
