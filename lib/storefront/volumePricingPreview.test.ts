import { describe, it, expect } from 'vitest'
import { computeVolumePricingPreview } from './volumePricingPreview'

describe('computeVolumePricingPreview', () => {
  it('no discount for 1-2 qualifying cases', () => {
    const preview = computeVolumePricingPreview([{ sellUnit: 'CASE_STANDARD', quantity: 2, price: 400 }])
    expect(preview.discountRate).toBe(0)
    expect(preview.finalSubtotal).toBe(800)
    expect(preview.nextTier).toEqual({ casesNeeded: 1, rate: 0.05 })
  })

  it('applies the 5% tier at 3 qualifying cases and reports the next tier', () => {
    const preview = computeVolumePricingPreview([{ sellUnit: 'CASE_STANDARD', quantity: 3, price: 400 }])
    expect(preview.discountRate).toBe(0.05)
    expect(preview.discountAmount).toBe(60)
    expect(preview.finalSubtotal).toBe(1140)
    expect(preview.nextTier).toEqual({ casesNeeded: 2, rate: 0.08 })
  })

  it('aggregates qualifying cases across multiple different products', () => {
    const preview = computeVolumePricingPreview([
      { sellUnit: 'CASE_STANDARD', quantity: 2, price: 400 },
      { sellUnit: 'CASE_STANDARD', quantity: 2, price: 200 },
    ])
    expect(preview.qualifyingCases).toBe(4)
    expect(preview.discountRate).toBe(0.05)
    expect(preview.standardSubtotal).toBe(1200)
  })

  it('never counts CASE_PRO, CASE_BULK, or INDIVIDUAL_VIAL toward the ladder', () => {
    const preview = computeVolumePricingPreview([
      { sellUnit: 'CASE_STANDARD', quantity: 1, price: 400 },
      { sellUnit: 'CASE_PRO', quantity: 20, price: 280 },
      { sellUnit: 'INDIVIDUAL_VIAL', quantity: 50, price: 49 },
    ])
    expect(preview.qualifyingCases).toBe(1)
    expect(preview.discountRate).toBe(0)
    expect(preview.standardSubtotal).toBe(400)
  })

  it('no next tier once already at 15+', () => {
    const preview = computeVolumePricingPreview([{ sellUnit: 'CASE_STANDARD', quantity: 15, price: 400 }])
    expect(preview.discountRate).toBe(0.15)
    expect(preview.nextTier).toBeNull()
  })

  it('an empty cart resolves to zero cases, zero discount, no next-tier crash', () => {
    const preview = computeVolumePricingPreview([])
    expect(preview.qualifyingCases).toBe(0)
    expect(preview.discountRate).toBe(0)
    expect(preview.nextTier).toEqual({ casesNeeded: 3, rate: 0.05 })
  })
})
