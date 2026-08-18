// Separate from testing claimFirstOrderOffer() itself (DB/email
// orchestration, untested here per this repo's convention). Covers only
// the two pure helpers.
import { describe, it, expect } from 'vitest'
import { splitName, generatePromotionCodeText, CODE_ALPHABET } from './firstOrderOfferClaim'

describe('splitName', () => {
  it('splits a first and last name on the first space', () => {
    expect(splitName('Jane Doe')).toEqual({ firstName: 'Jane', lastName: 'Doe' })
  })

  it('puts everything after the first space into lastName, including a middle name', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ firstName: 'Mary', lastName: 'Jane Watson' })
  })

  it('a single-word name becomes firstName with an empty lastName', () => {
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' })
  })

  it('trims leading/trailing whitespace before splitting', () => {
    expect(splitName('  Jane Doe  ')).toEqual({ firstName: 'Jane', lastName: 'Doe' })
  })

  it('trims extra internal whitespace from the lastName remainder', () => {
    expect(splitName('Jane   Doe')).toEqual({ firstName: 'Jane', lastName: 'Doe' })
  })
})

describe('generatePromotionCodeText', () => {
  it('always starts with the FIRST- prefix', () => {
    expect(generatePromotionCodeText().startsWith('FIRST-')).toBe(true)
  })

  it('generates an 8-character code after the prefix', () => {
    const code = generatePromotionCodeText()
    expect(code.slice('FIRST-'.length)).toHaveLength(8)
  })

  it('never includes visually-ambiguous characters (0, O, 1, I, L)', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      expect(CODE_ALPHABET).not.toContain(ch)
    }
  })

  it('every generated character comes from the defined alphabet', () => {
    const code = generatePromotionCodeText().slice('FIRST-'.length)
    for (const ch of code) {
      expect(CODE_ALPHABET).toContain(ch)
    }
  })

  it('generates different codes across calls (not a fixed/deterministic string)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generatePromotionCodeText()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
