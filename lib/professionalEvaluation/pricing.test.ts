import { describe, it, expect } from 'vitest'
import { resolveEvaluationUnitPrice, EvaluationPricingError } from './pricing'
import type { PricingProduct } from '@/lib/pricing/canonicalPricing'

function product(overrides: Partial<PricingProduct> = {}): PricingProduct {
  return {
    activeStandardCasePrice: 600,
    activeProCasePrice: null,
    activeBulkPrice: null,
    activeIndividualVialPrice: null,
    individualSalesEnabled: false,
    unitsPerCase: null,
    ...overrides,
  }
}

describe('resolveEvaluationUnitPrice', () => {
  it('divides the Standard case price by the canonical 10-vial default case size', () => {
    const result = resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: 600, unitsPerCase: 10 }), proEligible: false })
    expect(result).toEqual({ pricingSource: 'STANDARD', applicableCasePrice: 600, canonicalCaseQuantity: 10, evaluationUnitPrice: 60 })
  })

  it('never hardcodes 10 -- uses the product\'s real case quantity (e.g. a 6-vial case)', () => {
    const result = resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: 600, unitsPerCase: 6 }), proEligible: false })
    expect(result.canonicalCaseQuantity).toBe(6)
    expect(result.evaluationUnitPrice).toBe(100)
  })

  it('uses the Professional case price for a Professional-eligible customer on a product with one', () => {
    const result = resolveEvaluationUnitPrice({
      product: product({ activeStandardCasePrice: 775, activeProCasePrice: 625, unitsPerCase: 10 }),
      proEligible: true,
    })
    expect(result.pricingSource).toBe('PROFESSIONAL')
    expect(result.applicableCasePrice).toBe(625)
    expect(result.evaluationUnitPrice).toBe(62.5)
  })

  it('a Professional-eligible customer on a product with no Professional price still resolves Standard', () => {
    const result = resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: 400, activeProCasePrice: null, unitsPerCase: 10 }), proEligible: true })
    expect(result.pricingSource).toBe('STANDARD')
    expect(result.applicableCasePrice).toBe(400)
  })

  it('an active Preferred Price / Price Match authorization wins when lower, mapped to PREFERRED_PRICE', () => {
    const result = resolveEvaluationUnitPrice({
      product: product({ activeStandardCasePrice: 600, unitsPerCase: 10 }),
      proEligible: false,
      preferredPrice: 500,
    })
    expect(result.pricingSource).toBe('PREFERRED_PRICE')
    expect(result.applicableCasePrice).toBe(500)
    expect(result.evaluationUnitPrice).toBe(50)
  })

  it('a stale/higher preferredPrice never applies -- the better catalog price always wins', () => {
    const result = resolveEvaluationUnitPrice({
      product: product({ activeStandardCasePrice: 600, unitsPerCase: 10 }),
      proEligible: false,
      preferredPrice: 650,
    })
    expect(result.pricingSource).toBe('STANDARD')
    expect(result.applicableCasePrice).toBe(600)
  })

  it('a single evaluation unit never triggers the standard volume ladder (quantity is always 1 case-equivalent)', () => {
    // Volume ladder only ever applies at 3+ cases -- resolving at quantity 1
    // must never accidentally apply a discount meant for bulk purchasing.
    const result = resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: 400, unitsPerCase: 10 }), proEligible: false })
    expect(result.applicableCasePrice).toBe(400)
  })

  it('throws EvaluationPricingError when the product has no active price for the applicable tier', () => {
    expect(() => resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: null }), proEligible: false })).toThrow(EvaluationPricingError)
  })

  it('throws EvaluationPricingError when the product has no valid canonical case quantity', () => {
    expect(() => resolveEvaluationUnitPrice({ product: product({ activeStandardCasePrice: 600, unitsPerCase: 0 }), proEligible: false })).toThrow(EvaluationPricingError)
  })
})
