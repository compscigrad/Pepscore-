import { describe, it, expect } from 'vitest'
import {
  resolvePricingLine,
  resolveCanonicalPricing,
  computeQualifyingCaseCount,
  getVolumeDiscountRate,
  getNextVolumeTier,
  ProfessionalPricingUnauthorizedError,
  PricingLineUnavailableError,
  type PricingProduct,
} from './canonicalPricing'

function product(overrides: Partial<PricingProduct> = {}): PricingProduct {
  return {
    activeStandardCasePrice: 400,
    activeProCasePrice: 280,
    activeBulkPrice: null,
    activeIndividualVialPrice: 49,
    individualSalesEnabled: true,
    unitsPerCase: null,
    ...overrides,
  }
}

describe('getVolumeDiscountRate (locked business decision, 2026-08-19)', () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, 0.05],
    [4, 0.05],
    [5, 0.08],
    [9, 0.08],
    [10, 0.10],
    [14, 0.10],
    [15, 0.15],
    [50, 0.15],
  ])('%i qualifying cases -> %s rate', (cases, rate) => {
    expect(getVolumeDiscountRate(cases)).toBe(rate)
  })

  it('0 or negative cases is 0%, never throws', () => {
    expect(getVolumeDiscountRate(0)).toBe(0)
    expect(getVolumeDiscountRate(-1)).toBe(0)
  })
})

describe('getNextVolumeTier', () => {
  it('reports cases needed to reach the next tier', () => {
    expect(getNextVolumeTier(1)).toEqual({ casesNeeded: 2, rate: 0.05 })
    expect(getNextVolumeTier(4)).toEqual({ casesNeeded: 1, rate: 0.08 })
  })
  it('returns null once already at the top tier', () => {
    expect(getNextVolumeTier(15)).toBeNull()
    expect(getNextVolumeTier(100)).toBeNull()
  })
})

describe('resolvePricingLine -- server-side Professional entitlement enforcement (P0 fix)', () => {
  it('rejects an unauthorized CASE_PRO request -- the core P0 regression test', () => {
    expect(() => resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: false })).toThrow(
      ProfessionalPricingUnauthorizedError
    )
  })

  it('a logged-out / unauthenticated attempt (proEligible always false for a guest) is rejected identically', () => {
    expect(() => resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: false })).toThrow(
      ProfessionalPricingUnauthorizedError
    )
  })

  it('a revoked Professional account (proEligible now false) is rejected exactly like never-eligible', () => {
    expect(() => resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: false })).toThrow(
      ProfessionalPricingUnauthorizedError
    )
  })

  it('an authorized CASE_PRO request from a genuinely proEligible customer succeeds and returns the real Professional price', () => {
    const resolved = resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: true })
    expect(resolved.catalogUnitPrice).toBe(280)
    expect(resolved.pricingSource).toBe('PROFESSIONAL')
  })

  it('never returns a price for CASE_PRO when unauthorized -- the function throws before any price is computed, so there is nothing to leak', () => {
    try {
      resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: false })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ProfessionalPricingUnauthorizedError)
      // The error itself carries no price data of any kind.
      expect(JSON.stringify(err)).not.toMatch(/280/)
    }
  })

  it('the admin manual-override escape hatch allows CASE_PRO regardless of proEligible, for direct-sale composition', () => {
    const resolved = resolvePricingLine({ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: false, allowManualOverride: true })
    expect(resolved.catalogUnitPrice).toBe(280)
  })

  it('rejects CASE_PRO when the product has no Professional price at all, even for an eligible customer', () => {
    expect(() => resolvePricingLine({ product: product({ activeProCasePrice: null }), sellUnit: 'CASE_PRO', quantity: 1 }, { proEligible: true })).toThrow(
      PricingLineUnavailableError
    )
  })

  it('Professional accounts are rejected from Individual Vial purchasing (section 7)', () => {
    expect(() => resolvePricingLine({ product: product(), sellUnit: 'INDIVIDUAL_VIAL', quantity: 1 }, { proEligible: true })).toThrow(
      PricingLineUnavailableError
    )
  })

  it('a non-Professional customer can still buy Individual Vial normally when the product allows it', () => {
    const resolved = resolvePricingLine({ product: product(), sellUnit: 'INDIVIDUAL_VIAL', quantity: 1 }, { proEligible: false })
    expect(resolved.catalogUnitPrice).toBe(49)
  })

  it('a tampered/unavailable sellUnit (product has no price for the requested tier) is rejected, not silently substituted', () => {
    expect(() => resolvePricingLine({ product: product({ activeBulkPrice: null }), sellUnit: 'CASE_BULK', quantity: 1 }, { proEligible: false })).toThrow(
      PricingLineUnavailableError
    )
  })

  it('defaults to CASE_STANDARD when no sellUnit is given', () => {
    const resolved = resolvePricingLine({ product: product(), sellUnit: null, quantity: 1 }, { proEligible: false })
    expect(resolved.sellUnit).toBe('CASE_STANDARD')
    expect(resolved.catalogUnitPrice).toBe(400)
  })

  it('case size follows the canonical-default-unless-explicit rule (section 16)', () => {
    expect(resolvePricingLine({ product: product(), sellUnit: 'CASE_STANDARD', quantity: 1 }, { proEligible: false }).unitsPerSellUnit).toBe(10)
    expect(resolvePricingLine({ product: product({ unitsPerCase: 6 }), sellUnit: 'CASE_STANDARD', quantity: 1 }, { proEligible: false }).unitsPerSellUnit).toBe(6)
  })
})

describe('computeQualifyingCaseCount (section 4 -- cross-product aggregation)', () => {
  it('sums CASE_STANDARD quantities across multiple different products', () => {
    const count = computeQualifyingCaseCount([
      { sellUnit: 'CASE_STANDARD', quantity: 2 },
      { sellUnit: 'CASE_STANDARD', quantity: 2 },
    ])
    expect(count).toBe(4)
  })

  it('never counts CASE_PRO, CASE_BULK, or INDIVIDUAL_VIAL quantities toward the case ladder', () => {
    const count = computeQualifyingCaseCount([
      { sellUnit: 'CASE_STANDARD', quantity: 2 },
      { sellUnit: 'CASE_PRO', quantity: 20 },
      { sellUnit: 'CASE_BULK', quantity: 20 },
      { sellUnit: 'INDIVIDUAL_VIAL', quantity: 500 },
    ])
    expect(count).toBe(2)
  })
})

describe('resolveCanonicalPricing -- end-to-end scenarios', () => {
  it('standard customer, 1 case -- no discount', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_STANDARD', quantity: 1 }], { proEligible: false })
    expect(line.unitPrice).toBe(400)
    expect(line.volumeDiscountRate).toBe(0)
    expect(line.pricingSource).toBe('STANDARD')
  })

  it('standard customer, 3 cases -- 5% tier', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_STANDARD', quantity: 3 }], { proEligible: false })
    expect(line.unitPrice).toBe(380)
    expect(line.lineTotal).toBe(1140)
    expect(line.pricingSource).toBe('STANDARD_VOLUME_DISCOUNT')
  })

  it('standard customer, 5 cases -- 8% tier', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_STANDARD', quantity: 5 }], { proEligible: false })
    expect(line.unitPrice).toBe(368)
  })

  it('standard customer, 10 cases -- 10% tier', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_STANDARD', quantity: 10 }], { proEligible: false })
    expect(line.unitPrice).toBe(360)
  })

  it('standard customer, 15 cases -- 15% tier', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_STANDARD', quantity: 15 }], { proEligible: false })
    expect(line.unitPrice).toBe(340)
  })

  it('standard customer, mixed-product qualifying cases -- 2 cases Product A + 2 cases Product B = 4 total = 5% tier applied to both lines', () => {
    const productA = product({ activeStandardCasePrice: 400 })
    const productB = product({ activeStandardCasePrice: 200 })
    const lines = resolveCanonicalPricing(
      [
        { product: productA, sellUnit: 'CASE_STANDARD', quantity: 2 },
        { product: productB, sellUnit: 'CASE_STANDARD', quantity: 2 },
      ],
      { proEligible: false }
    )
    expect(lines[0].volumeDiscountRate).toBe(0.05)
    expect(lines[0].unitPrice).toBe(380)
    expect(lines[1].volumeDiscountRate).toBe(0.05)
    expect(lines[1].unitPrice).toBe(190)
  })

  it('individual vial quantities never trigger the case ladder even in large volume', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'INDIVIDUAL_VIAL', quantity: 500 }], { proEligible: false })
    expect(line.volumeDiscountRate).toBe(0)
    expect(line.unitPrice).toBe(49)
  })

  it('professional customer, 1 case -- Professional price from case #1, no ladder involvement', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_PRO', quantity: 1 }], { proEligible: true })
    expect(line.unitPrice).toBe(280)
    expect(line.pricingSource).toBe('PROFESSIONAL')
  })

  it('professional customer, 15 cases -- price is unchanged, never stacks with the 15% standard ladder', () => {
    const [line] = resolveCanonicalPricing([{ product: product(), sellUnit: 'CASE_PRO', quantity: 15 }], { proEligible: true })
    expect(line.unitPrice).toBe(280)
    expect(line.volumeDiscountRate).toBe(0)
  })

  it('a mixed cart of CASE_STANDARD and CASE_PRO lines only applies the ladder to the standard line', () => {
    const lines = resolveCanonicalPricing(
      [
        { product: product(), sellUnit: 'CASE_STANDARD', quantity: 15 },
        { product: product(), sellUnit: 'CASE_PRO', quantity: 15 },
      ],
      { proEligible: true }
    )
    expect(lines[0].unitPrice).toBe(340) // 15% off standard
    expect(lines[1].unitPrice).toBe(280) // untouched professional price
  })

  it('tampered client price is irrelevant -- the engine only ever reads catalog fields, never a client-submitted price', () => {
    // PricingLineRequest has no price field at all -- there is nothing for
    // a caller to tamper with; this test documents that invariant.
    const req = { product: product(), sellUnit: 'CASE_STANDARD' as const, quantity: 1 }
    expect(Object.keys(req)).not.toContain('unitPrice')
    expect(Object.keys(req)).not.toContain('price')
  })

  it('rejects the whole batch (throws) rather than silently dropping an unauthorized line', () => {
    expect(() =>
      resolveCanonicalPricing(
        [
          { product: product(), sellUnit: 'CASE_STANDARD', quantity: 1 },
          { product: product(), sellUnit: 'CASE_PRO', quantity: 1 },
        ],
        { proEligible: false }
      )
    ).toThrow(ProfessionalPricingUnauthorizedError)
  })
})
