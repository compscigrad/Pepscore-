import { describe, it, expect } from 'vitest'
import { derivePricingSourceStatus, deriveSpaInvariantViolated, deriveMissingPrice } from './adminProductMaster'

describe('derivePricingSourceStatus', () => {
  it('is NEEDS_REVIEW when the product has never been reviewed, regardless of override', () => {
    expect(derivePricingSourceStatus({ needsPricingReview: true, manualPricingOverride: true })).toBe('NEEDS_REVIEW')
    expect(derivePricingSourceStatus({ needsPricingReview: true, manualPricingOverride: false })).toBe('NEEDS_REVIEW')
  })
  it('is MANUAL_OVERRIDE when reviewed and flagged as a manual override', () => {
    expect(derivePricingSourceStatus({ needsPricingReview: false, manualPricingOverride: true })).toBe('MANUAL_OVERRIDE')
  })
  it('is FORMULA_DERIVED when reviewed and not overridden', () => {
    expect(derivePricingSourceStatus({ needsPricingReview: false, manualPricingOverride: false })).toBe('FORMULA_DERIVED')
  })
})

describe('deriveSpaInvariantViolated', () => {
  it('flags a violation when SPA equals Standard', () => {
    expect(deriveSpaInvariantViolated(500, 500)).toBe(true)
  })
  it('flags a violation when SPA exceeds Standard', () => {
    expect(deriveSpaInvariantViolated(600, 500)).toBe(true)
  })
  it('is not violated when SPA is properly below Standard', () => {
    expect(deriveSpaInvariantViolated(350, 500)).toBe(false)
  })
  it('is not violated when either price is unset (e.g. an archived product with no active pricing)', () => {
    expect(deriveSpaInvariantViolated(null, 500)).toBe(false)
    expect(deriveSpaInvariantViolated(350, null)).toBe(false)
    expect(deriveSpaInvariantViolated(null, null)).toBe(false)
  })
})

describe('deriveMissingPrice', () => {
  it('is missing when neither Standard nor Individual pricing exists', () => {
    expect(deriveMissingPrice(null, null)).toBe(true)
  })
  it('is not missing when Standard is set', () => {
    expect(deriveMissingPrice(500, null)).toBe(false)
  })
  it('is not missing when only Individual is set (e.g. a vial-only product)', () => {
    expect(deriveMissingPrice(null, 45)).toBe(false)
  })
})
