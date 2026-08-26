import { describe, it, expect } from 'vitest'
import { priceMatchRequestSchema, isHoneypotTripped } from './validation'

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    contactName: 'Jane Smith',
    contactEmail: 'jane@example.com',
    preferredContactMethod: 'EMAIL',
    productId: 'prod_1',
    sellUnit: 'CASE_STANDARD',
    competitorName: 'Acme Peptides',
    competitorPrice: 550,
    competitorDeliveredPrice: 598,
    sourcePage: '/price-match',
    consent: true,
    ...overrides,
  }
}

describe('priceMatchRequestSchema', () => {
  it('accepts a valid minimal payload', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload())
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ contactEmail: 'not-an-email' }))
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive competitor price', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ competitorPrice: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive delivered price', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ competitorDeliveredPrice: -5 }))
    expect(result.success).toBe(false)
  })

  it('rejects an invalid sellUnit', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ sellUnit: 'CASE_MYSTERY' }))
    expect(result.success).toBe(false)
  })

  it('requires consent to be explicitly true', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ consent: false }))
    expect(result.success).toBe(false)
  })

  it('does not require phone, competitorUrl, proof, or customerNote', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload())
    expect(result.success).toBe(true)
  })

  it('rejects a missing preferredContactMethod', () => {
    const { preferredContactMethod: _omit, ...rest } = basePayload()
    const result = priceMatchRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects preferredContactMethod: PHONE with no contactPhone', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ preferredContactMethod: 'PHONE' }))
    expect(result.success).toBe(false)
  })

  it('accepts preferredContactMethod: PHONE when contactPhone is provided', () => {
    const result = priceMatchRequestSchema.safeParse(basePayload({ preferredContactMethod: 'PHONE', contactPhone: '2025550148' }))
    expect(result.success).toBe(true)
  })
})

describe('isHoneypotTripped', () => {
  it('is false when the honeypot field is empty', () => {
    expect(isHoneypotTripped({ website2: '' })).toBe(false)
    expect(isHoneypotTripped({})).toBe(false)
  })

  it('is true when a bot fills in the hidden honeypot field', () => {
    expect(isHoneypotTripped({ website2: 'http://spam.example' })).toBe(true)
  })
})
