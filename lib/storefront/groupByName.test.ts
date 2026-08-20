import { describe, it, expect } from 'vitest'
import { groupByName } from './groupByName'
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
    activeProCasePrice: null,
    suggestedBulkPrice: null,
    activeBulkPrice: null,
    suggestedIndividualVialPrice: null,
    activeIndividualVialPrice: null,
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
    merchandisingStatus: 'NONE',
    ...overrides,
  } as Product
}

describe('groupByName -- Customer Preferred Pricing wiring (Price Match sprint)', () => {
  it('attaches a matching preferredPricesBySellUnit entry for the exact product + sellUnit', () => {
    const rows = [product({ id: 'p1', activeStandardCasePrice: 400 })]
    const [card] = groupByName(rows, { preferredPrices: { 'p1:CASE_STANDARD': 340 } })
    expect(card.variants[0].preferredPricesBySellUnit).toEqual({ CASE_STANDARD: 340 })
  })

  it('never leaks a preferred price onto an unrelated product (isolation)', () => {
    const rows = [product({ id: 'p1', activeStandardCasePrice: 400 }), product({ id: 'p2', slug: 'other', name: 'Other Peptide', activeStandardCasePrice: 500 })]
    const cards = groupByName(rows, { preferredPrices: { 'p1:CASE_STANDARD': 340 } })
    const p1 = cards.find((c) => c.name === 'Semaglutide')!
    const p2 = cards.find((c) => c.name === 'Other Peptide')!
    expect(p1.variants[0].preferredPricesBySellUnit).toEqual({ CASE_STANDARD: 340 })
    expect(p2.variants[0].preferredPricesBySellUnit).toEqual({})
  })

  it('never leaks a preferred price onto a different sellUnit of the same product', () => {
    const rows = [product({ id: 'p1', activeStandardCasePrice: 400, activeProCasePrice: 300 })]
    const [card] = groupByName(rows, { proEligible: true, preferredPrices: { 'p1:CASE_STANDARD': 340 } })
    // A CASE_STANDARD authorization must never apply to the CASE_PRO tier.
    expect(card.variants[0].preferredPricesBySellUnit?.CASE_PRO).toBeUndefined()
    expect(card.variants[0].preferredPricesBySellUnit?.CASE_STANDARD).toBe(340)
  })

  it('with no preferredPrices option at all, every variant gets an empty record (backward compatible)', () => {
    const rows = [product({ id: 'p1' })]
    const [card] = groupByName(rows)
    expect(card.variants[0].preferredPricesBySellUnit).toEqual({})
  })
})
