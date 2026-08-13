import { describe, it, expect } from 'vitest'
import { RUO_VERSION, RUO_INTRO_TEXT, RUO_AGE_TEXT, RUO_AGREEMENT_TEXT, RUO_TEXT } from './ruo'

// Locks the exact owner-provided copy (2026-08-12 pre-signup RUO/21+ gate
// spec) so a future refactor can't silently drift the legal wording -- a
// version bump is the only sanctioned way to change any of this text, and
// that's a deliberate, visible edit to these literals, not an accident.
describe('RUO copy matches the owner-provided agreement exactly', () => {
  it('has the current version set', () => {
    expect(RUO_VERSION).toBe('RUO-2026-01')
  })

  it('intro text matches exactly', () => {
    expect(RUO_INTRO_TEXT).toBe(
      'This website is restricted. To continue, please confirm you meet the minimum age requirement and accept the agreement below.'
    )
  })

  it('age confirmation text matches exactly', () => {
    expect(RUO_AGE_TEXT).toBe('I confirm I am 21+ years of age or older.')
  })

  it('RUO agreement text matches exactly', () => {
    expect(RUO_AGREEMENT_TEXT).toBe(
      'I agree that products and information on this website are provided for laboratory research use only and are not intended for use in or on humans or animals. I will not use any products or information from this website for diagnosis, treatment, cure, or prevention of any condition. I agree to follow applicable laws and regulations, and I agree to the Terms of Service and Privacy Policy.'
    )
  })

  it('combined RUO_TEXT includes all three sections in order', () => {
    expect(RUO_TEXT).toBe(`${RUO_INTRO_TEXT} ${RUO_AGE_TEXT} ${RUO_AGREEMENT_TEXT}`)
  })
})
