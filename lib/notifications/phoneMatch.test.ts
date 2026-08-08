import { describe, expect, it } from 'vitest'
import { digitsOnly, phoneNumbersMatch } from './phoneMatch'

describe('digitsOnly', () => {
  it('strips all non-digit characters', () => {
    expect(digitsOnly('+1 (555) 123-4567')).toBe('15551234567')
  })
})

describe('phoneNumbersMatch', () => {
  it('matches E.164 against a plain 10-digit number', () => {
    expect(phoneNumbersMatch('+15551234567', '5551234567')).toBe(true)
  })

  it('matches two differently-punctuated versions of the same number', () => {
    expect(phoneNumbersMatch('(555) 123-4567', '555.123.4567')).toBe(true)
  })

  it('matches E.164 against an 11-digit number with a leading 1', () => {
    expect(phoneNumbersMatch('+15551234567', '15551234567')).toBe(true)
  })

  it('does not match two different numbers', () => {
    expect(phoneNumbersMatch('+15551234567', '+15559876543')).toBe(false)
  })

  it('does not match when either input has no digits', () => {
    expect(phoneNumbersMatch('', '+15551234567')).toBe(false)
    expect(phoneNumbersMatch('+15551234567', '')).toBe(false)
  })

  it('does not match a too-short number even if the tail happens to align', () => {
    expect(phoneNumbersMatch('4567', '+15551234567')).toBe(false)
  })
})
