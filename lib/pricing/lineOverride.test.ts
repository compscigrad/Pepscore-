import { describe, it, expect } from 'vitest'
import { checkPriceDeviation, getPriceTierField, getInvoiceLinePriceTier } from './lineOverride'

function product(overrides: Partial<Record<'activeStandardCasePrice' | 'activeProCasePrice' | 'activeBulkPrice' | 'activeIndividualVialPrice', number | null>> = {}) {
  return {
    activeStandardCasePrice: 370,
    activeProCasePrice: 261,
    activeBulkPrice: 200,
    activeIndividualVialPrice: 49,
    ...overrides,
  }
}

describe('checkPriceDeviation', () => {
  it('never prompts when no sell unit is selected (legacy flat-price path)', () => {
    const result = checkPriceDeviation({ sellUnit: null, typedUnitPrice: 999, product: product() })
    expect(result).toEqual({ needsPrompt: false, authoritativePrice: null, tierField: null })
  })

  it('does not prompt when the typed price matches the catalog price exactly', () => {
    const result = checkPriceDeviation({ sellUnit: 'INDIVIDUAL_VIAL', typedUnitPrice: 49, product: product() })
    expect(result.needsPrompt).toBe(false)
    expect(result.authoritativePrice).toBe(49)
  })

  it('prompts when the typed price deviates from the catalog price for the selected tier', () => {
    const result = checkPriceDeviation({ sellUnit: 'INDIVIDUAL_VIAL', typedUnitPrice: 55, product: product() })
    expect(result.needsPrompt).toBe(true)
    expect(result.authoritativePrice).toBe(49)
    expect(result.tierField).toBe('activeIndividualVialPrice')
  })

  it('changing Individual Vial never reads or reports Standard/SPA/Bulk -- only its own tier field', () => {
    const result = checkPriceDeviation({ sellUnit: 'INDIVIDUAL_VIAL', typedUnitPrice: 55, product: product({ activeStandardCasePrice: 999 }) })
    expect(result.tierField).toBe('activeIndividualVialPrice')
    expect(result.authoritativePrice).toBe(49)
  })

  it('does not prompt when the catalog has no price stored for that tier yet (nothing to deviate from)', () => {
    const result = checkPriceDeviation({ sellUnit: 'CASE_BULK', typedUnitPrice: 250, product: product({ activeBulkPrice: null }) })
    expect(result.needsPrompt).toBe(false)
    expect(result.authoritativePrice).toBeNull()
  })

  it.each([
    ['CASE_STANDARD', 'activeStandardCasePrice'],
    ['CASE_PRO', 'activeProCasePrice'],
    ['CASE_BULK', 'activeBulkPrice'],
    ['INDIVIDUAL_VIAL', 'activeIndividualVialPrice'],
  ] as const)('maps sell unit %s to product field %s', (sellUnit, field) => {
    expect(getPriceTierField(sellUnit)).toBe(field)
  })

  it.each([
    ['CASE_STANDARD', 'STANDARD'],
    ['CASE_PRO', 'PRO'],
    ['CASE_BULK', 'BULK'],
    ['INDIVIDUAL_VIAL', 'INDIVIDUAL'],
  ] as const)('maps sell unit %s to invoice-line price tier %s', (sellUnit, tier) => {
    expect(getInvoiceLinePriceTier(sellUnit)).toBe(tier)
  })
})
