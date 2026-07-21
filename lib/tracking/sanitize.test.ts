import { describe, it, expect } from 'vitest'
import { sanitizeCarrierText } from './sanitize'

describe('sanitizeCarrierText', () => {
  it('strips HTML tags from carrier-provided text', () => {
    expect(sanitizeCarrierText('<script>alert(1)</script>In transit')).toBe('alert(1)In transit')
  })

  it('strips control characters', () => {
    expect(sanitizeCarrierText('In\x00transit\x07')).toBe('Intransit')
  })

  it('trims whitespace', () => {
    expect(sanitizeCarrierText('  In transit  ')).toBe('In transit')
  })

  it('truncates to the max length', () => {
    const longText = 'a'.repeat(600)
    expect(sanitizeCarrierText(longText, 500)).toHaveLength(500)
  })

  it('returns an empty string for null/undefined input', () => {
    expect(sanitizeCarrierText(null)).toBe('')
    expect(sanitizeCarrierText(undefined)).toBe('')
  })
})
