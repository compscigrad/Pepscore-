import { describe, it, expect } from 'vitest'
import { calculateSuggestedPricing, getEffectivePrice } from './engine'

describe('calculateSuggestedPricing', () => {
  // Every case below is a real row from the authoritative RUO price table
  // (Pepscore_RUO_Price_Table.xlsx), not a made-up example.
  it('reproduces the documented Retatrutide 60mg worked example exactly', () => {
    const result = calculateSuggestedPricing(326)
    expect(result.suggestedStandardCasePrice).toBe(2625)
    expect(result.suggestedSpaCasePrice).toBe(1850)
    expect(result.suggestedIndividualVialPrice).toBe(350)
  })

  it('reproduces Semaglutide 5mg (supplier cost 46)', () => {
    const result = calculateSuggestedPricing(46)
    expect(result.suggestedStandardCasePrice).toBe(370)
    expect(result.suggestedSpaCasePrice).toBe(261)
    expect(result.suggestedIndividualVialPrice).toBe(49)
  })

  it('reproduces Tesamorelin 10mg (supplier cost 177) — this is the formula baseline the manual competitive override replaces at the active-price layer, not this function', () => {
    const result = calculateSuggestedPricing(177)
    expect(result.suggestedStandardCasePrice).toBe(1425)
    expect(result.suggestedSpaCasePrice).toBe(1004)
    expect(result.suggestedIndividualVialPrice).toBe(190)
  })

  it('reproduces GLOW70 (supplier cost 186) as the pre-override formula baseline -- the real approved active prices (725/565/89) are a manual override set separately, not this function\'s output', () => {
    const result = calculateSuggestedPricing(186)
    expect(result.suggestedStandardCasePrice).toBe(1498)
    expect(result.suggestedSpaCasePrice).toBe(1056)
    expect(result.suggestedIndividualVialPrice).toBe(200)
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
