import { describe, it, expect } from 'vitest'
import { calculateSuggestedPricing, getEffectivePrice } from './engine'

describe('calculateSuggestedPricing', () => {
  // 2026-08-12 pricing revision pass #4: Standard/SPA now use the new
  // owner-directed model (supplierCaseCost x4, commercially rounded to the
  // nearest $10; SPA = Standard x the Retatrutide-derived ~0.705 ratio).
  // Individual Vial is unchanged (no replacement formula given yet).
  it('reproduces the Retatrutide 60mg example under the new model', () => {
    const result = calculateSuggestedPricing(326)
    expect(result.suggestedStandardCasePrice).toBe(1300)
    expect(result.suggestedSpaCasePrice).toBe(920)
    expect(result.suggestedIndividualVialPrice).toBe(350)
  })

  it('reproduces Semaglutide 5mg (supplier cost 46)', () => {
    const result = calculateSuggestedPricing(46)
    expect(result.suggestedStandardCasePrice).toBe(180)
    expect(result.suggestedSpaCasePrice).toBe(130)
    expect(result.suggestedIndividualVialPrice).toBe(49)
  })

  it('reproduces Tesamorelin 10mg (supplier cost 177) — this is the formula baseline the manual competitive override replaces at the active-price layer, not this function', () => {
    const result = calculateSuggestedPricing(177)
    expect(result.suggestedStandardCasePrice).toBe(710)
    expect(result.suggestedSpaCasePrice).toBe(500)
    expect(result.suggestedIndividualVialPrice).toBe(190)
  })

  it('reproduces KLOW (supplier cost 239) — matches the owner\'s own worked example ($239 x4 = $956, commercially rounded to $960)', () => {
    const result = calculateSuggestedPricing(239)
    expect(result.suggestedStandardCasePrice).toBe(960)
    expect(result.suggestedSpaCasePrice).toBe(680)
  })

  it('never lets SPA reach or exceed Standard Case, even at a supplier cost where naive rounding would collide them', () => {
    const result = calculateSuggestedPricing(4) // standard 4*4=16->20; naive spa 20*.705=14.1->10 (already fine, but assert the invariant explicitly)
    expect(result.suggestedSpaCasePrice).toBeLessThan(result.suggestedStandardCasePrice)
  })

  it('rejects negative supplier cost', () => {
    expect(() => calculateSuggestedPricing(-1)).toThrow()
  })

  it('rejects non-finite supplier cost', () => {
    expect(() => calculateSuggestedPricing(NaN)).toThrow()
    expect(() => calculateSuggestedPricing(Infinity)).toThrow()
  })

  it('handles zero supplier cost', () => {
    const result = calculateSuggestedPricing(0)
    expect(result.suggestedStandardCasePrice).toBe(0)
    expect(result.suggestedSpaCasePrice).toBe(0)
    expect(result.suggestedIndividualVialPrice).toBe(0)
  })
})

describe('getEffectivePrice', () => {
  it('returns the active price when one is set, even if it differs from the suggestion', () => {
    const product = {
      manualPricingOverride: true,
      suggestedStandardCasePrice: 1425,
      activeStandardCasePrice: 775,
      suggestedSpaCasePrice: 1004,
      activeSpaCasePrice: 700,
      suggestedIndividualVialPrice: 190,
      activeIndividualVialPrice: 80,
    }
    expect(getEffectivePrice(product, 'STANDARD')).toBe(775)
    expect(getEffectivePrice(product, 'SPA')).toBe(700)
    expect(getEffectivePrice(product, 'INDIVIDUAL')).toBe(80)
  })

  it('falls back to the suggested price when no override exists and no active price is set', () => {
    const product = {
      manualPricingOverride: false,
      suggestedStandardCasePrice: 370,
      activeStandardCasePrice: null,
      suggestedSpaCasePrice: 261,
      activeSpaCasePrice: null,
      suggestedIndividualVialPrice: 49,
      activeIndividualVialPrice: null,
    }
    expect(getEffectivePrice(product, 'STANDARD')).toBe(370)
  })

  it('returns null (not the formula value) when a product is flagged manualPricingOverride but the active price is not yet set — reviewed-but-unpublished, distinct from never-configured', () => {
    const product = {
      manualPricingOverride: true,
      suggestedStandardCasePrice: 2625,
      activeStandardCasePrice: null,
      suggestedSpaCasePrice: 1850,
      activeSpaCasePrice: null,
      suggestedIndividualVialPrice: 350,
      activeIndividualVialPrice: null,
    }
    expect(getEffectivePrice(product, 'STANDARD')).toBeNull()
  })

  it('a supplier-cost change recalculates the suggestion but getEffectivePrice still reports the untouched active price', () => {
    const beforeCostChange = {
      manualPricingOverride: true,
      suggestedStandardCasePrice: 1425,
      activeStandardCasePrice: 775,
      suggestedSpaCasePrice: 1004,
      activeSpaCasePrice: 700,
      suggestedIndividualVialPrice: 190,
      activeIndividualVialPrice: 80,
    }
    const afterCostChange = { ...beforeCostChange, ...calculateSuggestedPricing(200) }
    expect(afterCostChange.suggestedStandardCasePrice).not.toBe(beforeCostChange.suggestedStandardCasePrice)
    expect(getEffectivePrice(afterCostChange, 'STANDARD')).toBe(775)
  })
})
