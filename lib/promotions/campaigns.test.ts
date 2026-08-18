import { describe, it, expect } from 'vitest'
import { validateDiscount, PromotionCampaignError } from './campaigns'

describe('validateDiscount', () => {
  it('accepts a valid FIXED discount', () => {
    expect(() => validateDiscount('FIXED', 25)).not.toThrow()
  })

  it('accepts a valid PERCENTAGE discount', () => {
    expect(() => validateDiscount('PERCENTAGE', 50)).not.toThrow()
  })

  it('accepts a PERCENTAGE discount of exactly 100', () => {
    expect(() => validateDiscount('PERCENTAGE', 100)).not.toThrow()
  })

  it('rejects a zero discount value', () => {
    expect(() => validateDiscount('FIXED', 0)).toThrow(PromotionCampaignError)
  })

  it('rejects a negative discount value', () => {
    expect(() => validateDiscount('FIXED', -10)).toThrow(PromotionCampaignError)
  })

  it('rejects a PERCENTAGE discount over 100', () => {
    expect(() => validateDiscount('PERCENTAGE', 101)).toThrow(/cannot exceed 100/)
  })

  it('does NOT cap a FIXED discount at 100 -- the 100 ceiling is percentage-only', () => {
    expect(() => validateDiscount('FIXED', 500)).not.toThrow()
  })
})
