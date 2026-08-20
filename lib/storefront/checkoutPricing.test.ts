import { describe, it, expect } from 'vitest'
import { resolveCheckoutLine, computeVialsToReserve, CheckoutLineUnavailableError } from './checkoutPricing'
import type { Product } from '@prisma/client'

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'test-product',
    name: 'Semaglutide',
    category: 'peptide',
    size: '5mg',
    price: 0,
    bulkPrice5: null,
    bulkPrice10: null,
    description: '',
    imageUrl: '',
    badge: null,
    inStock: true,
    costOfGoods: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    sku: null,
    supplierCaseCost: null,
    unitsPerCase: 10,
    suggestedStandardCasePrice: null,
    activeStandardCasePrice: 370,
    suggestedProCasePrice: null,
    activeProCasePrice: 261,
    suggestedBulkPrice: null,
    activeBulkPrice: 200,
    suggestedIndividualVialPrice: null,
    activeIndividualVialPrice: 49,
    individualSalesEnabled: false,
    manualPricingOverride: false,
    pricingOverrideReason: null,
    pricingNotes: null,
    lastPricingReviewAt: null,
    pricingStatus: 'ACTIVE',
    inventoryTrackingEnabled: false,
    physicalStockOnHand: null,
    reservedUnits: 0,
    lowStockThreshold: null,
    inventoryStatus: 'TRACKING_DISABLED',
    backorderEnabled: false,
    individualVialBackorderEnabled: false,
    seoTitle: null,
    metaDescription: null,
    fullDescription: null,
    imageAltText: null,
    searchSynonyms: null,
    faq: null,
    relatedProductSlugs: [],
    featured: false,
    noindex: false,
    availabilityMessageOverride: null,
    ...overrides,
  } as Product
}

describe('resolveCheckoutLine', () => {
  it('defaults to CASE_STANDARD when the cart line has no sellUnit (every pre-3C cart)', () => {
    const resolved = resolveCheckoutLine(product(), null)
    expect(resolved).toEqual({ sellUnit: 'CASE_STANDARD', unitPrice: 370, unitsPerSellUnit: 10 })
  })

  it('resolves the real current price for a requested tier, never the client-sent price', () => {
    const resolved = resolveCheckoutLine(product(), 'CASE_PRO')
    expect(resolved.unitPrice).toBe(261)
    expect(resolved.unitsPerSellUnit).toBe(10)
  })

  it('resolves Individual Vial correctly when it is genuinely publicly enabled', () => {
    const resolved = resolveCheckoutLine(product({ individualSalesEnabled: true }), 'INDIVIDUAL_VIAL')
    expect(resolved).toEqual({ sellUnit: 'INDIVIDUAL_VIAL', unitPrice: 49, unitsPerSellUnit: 1 })
  })

  it('rejects Individual Vial when individualSalesEnabled is false -- checkout must never bypass the same gate the storefront itself enforces (unlike the admin-context bypass)', () => {
    expect(() => resolveCheckoutLine(product({ individualSalesEnabled: false }), 'INDIVIDUAL_VIAL')).toThrow(CheckoutLineUnavailableError)
  })

  it('rejects a tier the product has no active price for at all', () => {
    expect(() => resolveCheckoutLine(product({ activeBulkPrice: null }), 'CASE_BULK')).toThrow(CheckoutLineUnavailableError)
  })
})

describe('computeVialsToReserve', () => {
  it('multiplies quantity by unitsPerSellUnit -- 2 Standard Cases of 10 vials each reserves 20 vials, not 2', () => {
    expect(computeVialsToReserve(2, 10)).toBe(20)
  })

  it('an Individual Vial line (unitsPerSellUnit 1) reserves exactly the raw quantity', () => {
    expect(computeVialsToReserve(3, 1)).toBe(3)
  })

  it('falls back to 1 vial per unit when unitsPerSellUnit is missing (defensive, should be unreachable via resolveCheckoutLine)', () => {
    expect(computeVialsToReserve(5, null)).toBe(5)
    expect(computeVialsToReserve(5, undefined)).toBe(5)
  })
})
