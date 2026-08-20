import { describe, it, expect } from 'vitest'
import { resolveReorderLine } from './reorder'
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

describe('resolveReorderLine', () => {
  it('resolves an in-stock Standard Case purchase to the CURRENT price, not a historical one', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'CASE_STANDARD', quantity: 2 }, product({ activeStandardCasePrice: 400 }))
    expect(result).toEqual({
      status: 'RESOLVED',
      productId: 'p1',
      sellUnit: 'CASE_STANDARD',
      quantity: 2,
      unitPrice: 400,
      unitsPerSellUnit: 10,
      backordered: false,
    })
  })

  it('defaults to CASE_STANDARD when the historical line has no sellUnit (a pre-3C OrderItem)', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: null, quantity: 1 }, product())
    expect(result.status).toBe('RESOLVED')
    expect(result.status === 'RESOLVED' && result.sellUnit).toBe('CASE_STANDARD')
  })

  it('flags product_not_found when the product row no longer exists', () => {
    const result = resolveReorderLine({ productId: 'gone', sellUnit: 'CASE_STANDARD', quantity: 1 }, null)
    expect(result).toEqual({ status: 'UNAVAILABLE', productId: 'gone', requestedSellUnit: 'CASE_STANDARD', reason: 'product_not_found' })
  })

  it('flags discontinued when the product is INACTIVE', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'CASE_STANDARD', quantity: 1 }, product({ pricingStatus: 'INACTIVE' }))
    expect(result).toEqual({ status: 'UNAVAILABLE', productId: 'p1', requestedSellUnit: 'CASE_STANDARD', reason: 'discontinued' })
  })

  it('flags out_of_stock when the product is out of stock and not backorderable', () => {
    const result = resolveReorderLine(
      { productId: 'p1', sellUnit: 'CASE_STANDARD', quantity: 1 },
      product({ inventoryTrackingEnabled: true, inventoryStatus: 'OUT_OF_STOCK', backorderEnabled: false })
    )
    expect(result).toEqual({ status: 'UNAVAILABLE', productId: 'p1', requestedSellUnit: 'CASE_STANDARD', reason: 'out_of_stock' })
  })

  it('resolves with backordered: true (not UNAVAILABLE) when the product is out of stock but backorderable -- Buy Again allows it with an indicator, same as a fresh purchase', () => {
    const result = resolveReorderLine(
      { productId: 'p1', sellUnit: 'CASE_STANDARD', quantity: 1 },
      product({ inventoryTrackingEnabled: true, inventoryStatus: 'OUT_OF_STOCK', backorderEnabled: true })
    )
    expect(result.status).toBe('RESOLVED')
    expect(result.status === 'RESOLVED' && result.backordered).toBe(true)
  })

  it('flags sell_unit_no_longer_offered when a historical Individual Vial purchase is no longer offered (individualSalesEnabled turned off since)', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'INDIVIDUAL_VIAL', quantity: 1 }, product({ individualSalesEnabled: false }))
    expect(result).toEqual({ status: 'UNAVAILABLE', productId: 'p1', requestedSellUnit: 'INDIVIDUAL_VIAL', reason: 'sell_unit_no_longer_offered' })
  })

  it('resolves Individual Vial correctly when it is genuinely still offered', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'INDIVIDUAL_VIAL', quantity: 3 }, product({ individualSalesEnabled: true }))
    expect(result).toEqual({
      status: 'RESOLVED',
      productId: 'p1',
      sellUnit: 'INDIVIDUAL_VIAL',
      quantity: 3,
      unitPrice: 49,
      unitsPerSellUnit: 1,
      backordered: false,
    })
  })

  it('never substitutes a different product -- an unavailable line always reports the exact same productId requested', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'CASE_BULK', quantity: 1 }, product({ activeBulkPrice: null }))
    expect(result.productId).toBe('p1')
    expect(result.status).toBe('UNAVAILABLE')
  })

  it('stays gated by individualSalesEnabled by default (adminContext omitted) -- regression check that admin-assisted reorder cannot accidentally become the default', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'INDIVIDUAL_VIAL', quantity: 1 }, product({ individualSalesEnabled: false }))
    expect(result).toEqual({ status: 'UNAVAILABLE', productId: 'p1', requestedSellUnit: 'INDIVIDUAL_VIAL', reason: 'sell_unit_no_longer_offered' })
  })

  it('with { adminContext: true }, resolves Individual Vial even when individualSalesEnabled is false -- mirrors the admin invoice builder bypass (Decision #50)', () => {
    const result = resolveReorderLine({ productId: 'p1', sellUnit: 'INDIVIDUAL_VIAL', quantity: 1 }, product({ individualSalesEnabled: false }), { adminContext: true })
    expect(result.status).toBe('RESOLVED')
    expect(result.status === 'RESOLVED' && result.sellUnit).toBe('INDIVIDUAL_VIAL')
  })
})
