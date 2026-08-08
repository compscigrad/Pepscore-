import { describe, it, expect } from 'vitest'
import { maskContact } from './reminderPreview'

describe('maskContact', () => {
  it('masks an email, keeping the first two local-part characters and the full domain', () => {
    expect(maskContact('marcus@example.org', null)).toBe('ma••••@example.org')
  })

  it('masks a short local part down to at least one bullet', () => {
    expect(maskContact('jo@example.org', null)).toBe('jo•@example.org')
  })

  it('falls back gracefully for a malformed email with no domain', () => {
    expect(maskContact('not-an-email', null)).toBe('•••')
  })

  it('masks a phone to only its last 4 digits', () => {
    expect(maskContact(null, '(786) 253-2797')).toBe('(•••) •••-2797')
  })

  it('falls back gracefully for a too-short phone', () => {
    expect(maskContact(null, '123')).toBe('•••')
  })

  it('prefers email over phone when both are present', () => {
    expect(maskContact('marcus@example.org', '7862532797')).toBe('ma••••@example.org')
  })

  it('returns an em dash when neither is present', () => {
    expect(maskContact(null, null)).toBe('—')
  })
})
