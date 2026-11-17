import { describe, expect, it } from 'vitest'
import { beggarGesture, beggarLine, exchangeFor, exchangeLines, inExchangeWindow, PROMOTER_LINES, promoterLine, STREET_NAMES, STREET_PRODUCT, streetLine } from './street-life.ts'

describe('vendor names', () => {
  it('the two vendors Ricky named first show their personal names', () => {
    expect(STREET_NAMES.bakso).toBe('Dinov Safdijal')
    expect(STREET_NAMES.cilok).toBe('Andi Masta')
  })
  it('the remaining sellers now have names too', () => {
    expect(STREET_NAMES.nasgor).toBe('Tejo')
    expect(STREET_NAMES.penyet).toBe('Bejo')
    expect(STREET_NAMES.kopi).toBe('Moko')
    expect(STREET_NAMES.pengamen).toBe('Pengamen Anto')
  })
  it('every named seller keeps their product visible as a subtitle', () => {
    expect(STREET_PRODUCT.bakso).toBe('Bakso')
    expect(STREET_PRODUCT.cilok).toBe('Cilok')
    expect(STREET_PRODUCT.nasgor).toBe('Nasi Goreng')
    expect(STREET_PRODUCT.penyet).toBe('Ayam Penyet')
    expect(STREET_PRODUCT.kopi).toBe('Kopi')
  })
  it('the named vendors introduce themselves in their call-outs', () => {
    expect(streetLine('bakso', 0)).toBe('Bakso Malang, saya Dinov!')
    expect(streetLine('cilok', 18_000)).toBe('Cilok kenyal, saya Andi!')
    expect(streetLine('nasgor', 12_000)).toBe('Nasi goreng, saya Tejo!')
    expect(streetLine('penyet', 6_000)).toBe('Ayam penyet, saya Bejo!')
    expect(streetLine('kopi', 0)).toBe('Kopi, saya Moko!')
  })
  it('the busker sings, then asks for money', () => {
    expect(streetLine('pengamen', 18_000)).toBe('🎵 Lagu lama, buat yang rindu...')
    expect(streetLine('pengamen', 42_000)).toBe('Minta duitnya, Bang...')
    expect(streetLine('pengamen', 66_000)).toBe('🎵 Terima kasih, kawan!')
  })
  it('the busker sings Ricky\'s lyric verbatim, cycling with his other lines', () => {
    // Line index 3 of his 4-line cycle: floor(90000 / 24000) = 3, and his speaking
    // window covers it (phase (90000 + 5 * 6000) % 24000 = 0).
    expect(streetLine('pengamen', 90_000)).toBe('Hidup jadi WNI oooh... rasanya Seperti di Neraka... Kasihanilah Aku..uuu..uu')
  })
})

describe('street call-outs', () => {
  it('a vendor calls out in its speaking window and is quiet outside it', () => {
    // Tukang Cilok is staggered to speak at now % 24000 in [18000, 24000).
    expect(streetLine('cilok', 18_000)).toBe('Cilok kenyal, saya Andi!')
    expect(streetLine('cilok', 0)).toBeNull()
    expect(streetLine('cilok', 23_999)).toBe('Cilok kenyal, saya Andi!')
    expect(streetLine('cilok', 24_000)).toBeNull()
  })
  it('the call-out line rotates each cycle', () => {
    expect(streetLine('cilok', 18_000)).not.toBe(streetLine('cilok', 42_000))
  })
  it('the guard and the busker have their own lines', () => {
    expect(streetLine('satpam', 14_000)).toBeTruthy()
    expect(streetLine('pengamen', 19_000)).toBeTruthy()
  })
})

describe('beggar', () => {
  it('begs, then thanks, then is quiet', () => {
    expect(beggarLine(1_000)).toBe('Mohon sumbangan...')
    expect(beggarLine(5_000)).toBe('Terima kasih, semoga lancar rezekinya!')
    expect(beggarLine(8_000)).toBeNull()
  })
  it('the gesture ramps up, holds, and ramps down inside the begging window', () => {
    expect(beggarGesture(100)).toBeGreaterThan(0)
    expect(beggarGesture(100)).toBeLessThan(1)
    expect(beggarGesture(1_500)).toBe(1)
    expect(beggarGesture(2_900)).toBeGreaterThan(0)
    expect(beggarGesture(2_900)).toBeLessThan(1)
    expect(beggarGesture(5_000)).toBe(0)
  })
})

describe('snack exchanges', () => {
  it('the window opens after arrival and closes before the stop ends', () => {
    expect(inExchangeWindow(7_999)).toBe(false)
    expect(inExchangeWindow(8_000)).toBe(true)
    expect(inExchangeWindow(19_999)).toBe(true)
    expect(inExchangeWindow(20_000)).toBe(false)
    expect(inExchangeWindow(32_000 + 9_000)).toBe(true)
  })
  it('an exchange has a customer line and a vendor reply inside the window', () => {
    const lines = exchangeFor('cilok', 9_000)
    expect(lines?.agent).toBe('Ciloknya sepuluh ribu, Bang!')
    expect(lines?.vendor).toBe('Siap, ditunggu sebentar!')
    expect(exchangeFor('cilok', 1_000)).toBeNull()
    expect(exchangeFor('lounge', 9_000)).toBeNull()
  })
  it('exchange lines are available without the window for the rider stop', () => {
    expect(exchangeLines('nasgor', 1_000)?.agent).toBe('Nasi goreng satu, Bang!')
    expect(exchangeLines('penyet', 1_000)?.vendor).toBeTruthy()
    expect(exchangeLines('jalan', 1_000)).toBeNull()
  })
})

describe('Ricky the promoter', () => {
  it('has four different bubbles, two per theme', () => {
    expect(PROMOTER_LINES).toHaveLength(4)
    expect(new Set(PROMOTER_LINES).size).toBe(4)
    const follow = PROMOTER_LINES.filter((line) => /Follow|Subscribe|richkeyrick\.com/i.test(line))
    const music = PROMOTER_LINES.filter((line) => /RMP|musik/i.test(line))
    expect(follow).toHaveLength(2)
    expect(music).toHaveLength(2)
  })
  it('mentions the socials, the site, the promo price and the WhatsApp number', () => {
    const joined = PROMOTER_LINES.join(' ')
    expect(joined).toMatch(/YouTube/)
    expect(joined).toMatch(/Instagram/)
    expect(joined).toMatch(/TikTok/)
    expect(joined).toMatch(/Facebook/)
    expect(joined).toMatch(/www\.richkeyrick\.com/)
    expect(joined).toMatch(/anak Aceh/)
    expect(joined).toMatch(/Rp300rb/)
    expect(joined).toMatch(/0852-6011-3313/)
  })
  it('cycles through all four lines in order, then is quiet at the end of each window', () => {
    expect(promoterLine(0)).toBe(PROMOTER_LINES[0])
    expect(promoterLine(10_000)).toBe(PROMOTER_LINES[1])
    expect(promoterLine(20_000)).toBe(PROMOTER_LINES[2])
    expect(promoterLine(30_000)).toBe(PROMOTER_LINES[3])
    expect(promoterLine(40_000)).toBe(PROMOTER_LINES[0])
    expect(promoterLine(7_000)).toBeNull()
    expect(promoterLine(9_999)).toBeNull()
    expect(promoterLine(17_000)).toBeNull()
  })
})
