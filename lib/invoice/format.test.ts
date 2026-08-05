import { describe, it, expect } from 'vitest'
import { formatPhoneDisplay, formatLabelSourceLabel } from './format'

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

describe('formatLabelSourceLabel', () => {
  it('maps every known LabelSource value to a readable label', () => {
    expect(formatLabelSourceLabel('PIRATE_SHIP')).toBe('Pirate Ship')
    expect(formatLabelSourceLabel('SHIPPO')).toBe('Shippo')
    expect(formatLabelSourceLabel('USPS_DIRECT')).toBe('USPS (direct)')
    expect(formatLabelSourceLabel('UPS_DIRECT')).toBe('UPS (direct)')
    expect(formatLabelSourceLabel('FEDEX_DIRECT')).toBe('FedEx (direct)')
    expect(formatLabelSourceLabel('OTHER_MANUAL')).toBe('Other / Manual')
  })

  it('falls back to underscore-replaced text for an unrecognized value', () => {
    expect(formatLabelSourceLabel('SOME_NEW_VALUE')).toBe('SOME NEW_VALUE')
  })
})
