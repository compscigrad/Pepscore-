import { describe, it, expect } from 'vitest'
import { computePriceChangeRows, computeTierDiffs } from './history'
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
    unitsPerCase: null,
    suggestedStandardCasePrice: null,
    activeStandardCasePrice: 370,
    suggestedSpaCasePrice: null,
    activeSpaCasePrice: 261,
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

describe('computePriceChangeRows', () => {
  it('records one row for exactly the tier that changed', () => {
    const before = product({ activeIndividualVialPrice: 49 })
    const after = product({ activeIndividualVialPrice: 55 })
    const rows = computePriceChangeRows({ before, after, actorId: 'admin1', source: 'ADMIN_PRICING_PAGE' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      sellUnit: 'INDIVIDUAL_VIAL',
      previousPrice: 49,
      newPrice: 55,
      actorId: 'admin1',
      source: 'ADMIN_PRICING_PAGE',
      reason: null,
    })
  })

  it('never records a row for tiers that did not change (Individual Vial change must not touch Standard/SPA/Bulk)', () => {
    const before = product({ activeStandardCasePrice: 370, activeSpaCasePrice: 261, activeBulkPrice: 200, activeIndividualVialPrice: 49 })
    const after = product({ activeStandardCasePrice: 370, activeSpaCasePrice: 261, activeBulkPrice: 200, activeIndividualVialPrice: 55 })
    const rows = computePriceChangeRows({ before, after, actorId: 'admin1', source: 'ADMIN_PRICING_PAGE' })

    expect(rows.map((r) => r.sellUnit)).toEqual(['INDIVIDUAL_VIAL'])
  })

  it('records multiple rows when multiple tiers change in one write', () => {
    const before = product({ activeStandardCasePrice: 370, activeIndividualVialPrice: 49 })
    const after = product({ activeStandardCasePrice: 400, activeIndividualVialPrice: 55 })
    const rows = computePriceChangeRows({ before, after, actorId: 'admin1', source: 'ADMIN_PRICING_PAGE' })

    expect(rows.map((r) => r.sellUnit).sort()).toEqual(['INDIVIDUAL_VIAL', 'STANDARD_CASE'])
  })

  it('records a transition from null to a real price, and from a real price to null (unpublishing)', () => {
    const nullToPrice = computePriceChangeRows({
      before: product({ activeBulkPrice: null }),
      after: product({ activeBulkPrice: 200 }),
      actorId: 'admin1',
      source: 'ADMIN_PRICING_PAGE',
    })
    expect(nullToPrice).toEqual([expect.objectContaining({ sellUnit: 'BULK', previousPrice: null, newPrice: 200 })])

    const priceToNull = computePriceChangeRows({
      before: product({ activeBulkPrice: 200 }),
      after: product({ activeBulkPrice: null }),
      actorId: 'admin1',
      source: 'ADMIN_PRICING_PAGE',
    })
    expect(priceToNull).toEqual([expect.objectContaining({ sellUnit: 'BULK', previousPrice: 200, newPrice: null })])
  })

  it('produces zero rows when nothing changed', () => {
    const same = product()
    const rows = computePriceChangeRows({ before: same, after: same, actorId: 'admin1', source: 'ADMIN_PRICING_PAGE' })
    expect(rows).toEqual([])
  })

  it('carries the source and optional reason through to every row', () => {
    const before = product({ activeStandardCasePrice: 370, activeIndividualVialPrice: 49 })
    const after = product({ activeStandardCasePrice: 400, activeIndividualVialPrice: 55 })
    const rows = computePriceChangeRows({
      before,
      after,
      actorId: 'admin1',
      source: 'INVOICE_LINE_UPDATE_PRODUCT_PRICE',
      reason: 'Supplier cost increase',
    })
    expect(rows.every((r) => r.source === 'INVOICE_LINE_UPDATE_PRODUCT_PRICE' && r.reason === 'Supplier cost increase')).toBe(true)
  })

  it('denormalizes productName/productSize from the after row (the current name at time of change)', () => {
    const before = product({ name: 'Semaglutide', size: '5mg', activeStandardCasePrice: 370 })
    const after = product({ name: 'Semaglutide', size: '5mg', activeStandardCasePrice: 400 })
    const rows = computePriceChangeRows({ before, after, actorId: 'admin1', source: 'ADMIN_PRICING_PAGE' })
    expect(rows[0]).toMatchObject({ productId: 'p1', productName: 'Semaglutide', productSize: '5mg' })
  })
})

// The shared diffing primitive both computePriceChangeRows (post-commit
// audit) and the admin pricing panel's global-update preview (Phase 3B item
// 4, pre-commit) are built on -- tested directly since it's the one place
// "which tiers actually changed" is decided.
describe('computeTierDiffs', () => {
  it('returns only the tiers that changed, with no product/actor/source noise', () => {
    const before = product({ activeIndividualVialPrice: 49 })
    const after = product({ activeIndividualVialPrice: 55 })
    expect(computeTierDiffs(before, after)).toEqual([{ sellUnit: 'INDIVIDUAL_VIAL', previousPrice: 49, newPrice: 55 }])
  })

  it('returns an empty array when nothing changed', () => {
    const same = product()
    expect(computeTierDiffs(same, same)).toEqual([])
  })

  it('works against a partial (Pick) product shape, not just a full Product row -- the preview UI only has form-field values, not a full database row', () => {
    const before = { activeStandardCasePrice: 370, activeSpaCasePrice: 261, activeBulkPrice: 200, activeIndividualVialPrice: 49 }
    const after = { activeStandardCasePrice: 400, activeSpaCasePrice: 261, activeBulkPrice: 200, activeIndividualVialPrice: 49 }
    expect(computeTierDiffs(before, after)).toEqual([{ sellUnit: 'STANDARD_CASE', previousPrice: 370, newPrice: 400 }])
  })
})
