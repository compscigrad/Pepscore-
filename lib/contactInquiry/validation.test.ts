import { describe, it, expect } from 'vitest'
import { contactInquirySchema, isHoneypotTripped } from './validation'

const base = {
  name: 'Marvin Alexander',
  email: 'marvin@example.com',
  message: 'Interested in bulk pricing for Semaglutide.',
}

describe('contactInquirySchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(contactInquirySchema.safeParse(base).success).toBe(true)
  })

  it('accepts an optional phone and company', () => {
    const result = contactInquirySchema.safeParse({ ...base, phone: '2024253161', company: 'Acme Labs' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing name', () => {
    expect(contactInquirySchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(contactInquirySchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects a missing message', () => {
    expect(contactInquirySchema.safeParse({ ...base, message: '' }).success).toBe(false)
  })

  it('rejects a message over the length cap', () => {
    expect(contactInquirySchema.safeParse({ ...base, message: 'x'.repeat(4001) }).success).toBe(false)
  })
})

describe('isHoneypotTripped', () => {
  it('is false when the honeypot field is empty', () => {
    expect(isHoneypotTripped({ website: '' })).toBe(false)
    expect(isHoneypotTripped({})).toBe(false)
  })

  it('is true when the honeypot field is filled', () => {
    expect(isHoneypotTripped({ website: 'https://spam.example.com' })).toBe(true)
  })
})
