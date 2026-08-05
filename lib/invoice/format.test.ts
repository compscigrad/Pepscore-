import { describe, it, expect } from 'vitest'
import { formatPhoneDisplay } from './format'

describe('formatPhoneDisplay', () => {
  it('formats a plain 10-digit US number', () => {
    expect(formatPhoneDisplay('4058197482')).toBe('(405) 819-7482')
  })

  it('formats a US number with existing punctuation', () => {
    expect(formatPhoneDisplay('(405) 819-7482')).toBe('(405) 819-7482')
    expect(formatPhoneDisplay('405-819-7482')).toBe('(405) 819-7482')
  })

  it('formats an 11-digit number with a leading US country code', () => {
    expect(formatPhoneDisplay('14058197482')).toBe('(405) 819-7482')
    expect(formatPhoneDisplay('+1 405 819 7482')).toBe('(405) 819-7482')
  })

  it('leaves an international E.164 number unchanged', () => {
    expect(formatPhoneDisplay('+442071838750')).toBe('+442071838750')
  })

  it('leaves an unrecognized legacy value unchanged rather than mangling it', () => {
    expect(formatPhoneDisplay('call the office')).toBe('call the office')
  })

  it('returns an empty string for null/undefined/empty input', () => {
    expect(formatPhoneDisplay(null)).toBe('')
    expect(formatPhoneDisplay(undefined)).toBe('')
    expect(formatPhoneDisplay('')).toBe('')
  })
})
