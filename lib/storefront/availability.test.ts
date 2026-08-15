import { describe, it, expect } from 'vitest'
import { getStorefrontAvailability, isPurchasable, AVAILABILITY_LABEL } from './availability'

function product(overrides: Partial<Parameters<typeof getStorefrontAvailability>[0]>) {
  return {
    inStock: true,
    inventoryTrackingEnabled: false,
    inventoryStatus: 'TRACKING_DISABLED' as const,
    physicalStockOnHand: null,
    reservedUnits: 0,
    backorderEnabled: false,
    individualVialBackorderEnabled: false,
    ...overrides,
  }
}

describe('getStorefrontAvailability', () => {
  describe('inventory tracking disabled (legacy inStock boolean)', () => {
    it('is AVAILABLE when inStock is true', () => {
      expect(getStorefrontAvailability(product({ inStock: true }))).toBe('AVAILABLE')
    })

    it('is OUT_OF_STOCK when inStock is false and backorders are not enabled', () => {
      expect(getStorefrontAvailability(product({ inStock: false, backorderEnabled: false }))).toBe('OUT_OF_STOCK')
    })

    it('is BACKORDERED when inStock is false and backorders are enabled', () => {
      expect(getStorefrontAvailability(product({ inStock: false, backorderEnabled: true }))).toBe('BACKORDERED')
    })

    it('is BACKORDERED when inStock is TRUE and backorders are enabled (2026-08-15 regression) -- Produced to Order is an explicit admin decision, not merely a fallback for when inStock happens to be false. Previously this returned AVAILABLE, silently ignoring backorderEnabled for the untracked-inventory majority of the catalog.', () => {
      expect(getStorefrontAvailability(product({ inStock: true, backorderEnabled: true }))).toBe('BACKORDERED')
    })
  })

  describe('inventory tracking enabled', () => {
    it('AWAITING_INITIALIZATION is always COMING_SOON, regardless of backorderEnabled', () => {
      expect(
        getStorefrontAvailability(
          product({ inventoryTrackingEnabled: true, inventoryStatus: 'AWAITING_INITIALIZATION', backorderEnabled: true })
        )
      ).toBe('COMING_SOON')
      expect(
        getStorefrontAvailability(
          product({ inventoryTrackingEnabled: true, inventoryStatus: 'AWAITING_INITIALIZATION', backorderEnabled: false })
        )
      ).toBe('COMING_SOON')
    })

    it('IN_STOCK is AVAILABLE', () => {
      expect(getStorefrontAvailability(product({ inventoryTrackingEnabled: true, inventoryStatus: 'IN_STOCK' }))).toBe('AVAILABLE')
    })

    it('LOW_STOCK is LIMITED', () => {
      expect(getStorefrontAvailability(product({ inventoryTrackingEnabled: true, inventoryStatus: 'LOW_STOCK' }))).toBe('LIMITED')
    })

    it('OUT_OF_STOCK with backorderEnabled=false is OUT_OF_STOCK', () => {
      expect(
        getStorefrontAvailability(product({ inventoryTrackingEnabled: true, inventoryStatus: 'OUT_OF_STOCK', backorderEnabled: false }))
      ).toBe('OUT_OF_STOCK')
    })

    it('OUT_OF_STOCK with backorderEnabled=true is BACKORDERED -- never derived from another customer\'s BackorderCondition', () => {
      expect(
        getStorefrontAvailability(product({ inventoryTrackingEnabled: true, inventoryStatus: 'OUT_OF_STOCK', backorderEnabled: true }))
      ).toBe('BACKORDERED')
    })

    it('TRACKING_DISABLED status with inStock=true and backorderEnabled=true is BACKORDERED (2026-08-15 regression, same bug as the untracked branch)', () => {
      expect(
        getStorefrontAvailability(
          product({ inventoryTrackingEnabled: true, inventoryStatus: 'TRACKING_DISABLED', inStock: true, backorderEnabled: true })
        )
      ).toBe('BACKORDERED')
    })
  })

  describe('restock resolves availability correctly', () => {
    it('a product that goes from OUT_OF_STOCK/backorderable back to IN_STOCK reports AVAILABLE, not BACKORDERED', () => {
      const backordered = product({ inventoryTrackingEnabled: true, inventoryStatus: 'OUT_OF_STOCK', backorderEnabled: true })
      expect(getStorefrontAvailability(backordered)).toBe('BACKORDERED')
      const restocked = { ...backordered, inventoryStatus: 'IN_STOCK' as const }
      expect(getStorefrontAvailability(restocked)).toBe('AVAILABLE')
    })
  })

  describe('sell-unit-level fulfillment (2026-08-15) -- CASE and INDIVIDUAL_VIAL are independent physical-stock pools', () => {
    it('defaults to the CASE flag when no sellUnit is passed', () => {
      const p = product({ backorderEnabled: true, individualVialBackorderEnabled: false })
      expect(getStorefrontAvailability(p)).toBe('BACKORDERED')
      expect(getStorefrontAvailability(p, 'CASE')).toBe('BACKORDERED')
    })

    it('a single vial can be Ready to Ship while the case is Produced to Order', () => {
      const p = product({ backorderEnabled: true, individualVialBackorderEnabled: false })
      expect(getStorefrontAvailability(p, 'CASE')).toBe('BACKORDERED')
      expect(getStorefrontAvailability(p, 'INDIVIDUAL_VIAL')).toBe('AVAILABLE')
    })

    it('a case can be Ready to Ship while the single vial is Produced to Order', () => {
      const p = product({ backorderEnabled: false, individualVialBackorderEnabled: true })
      expect(getStorefrontAvailability(p, 'CASE')).toBe('AVAILABLE')
      expect(getStorefrontAvailability(p, 'INDIVIDUAL_VIAL')).toBe('BACKORDERED')
    })

    it('with tracked inventory, OUT_OF_STOCK still resolves per sell unit independently', () => {
      const p = product({
        inventoryTrackingEnabled: true,
        inventoryStatus: 'OUT_OF_STOCK',
        backorderEnabled: false,
        individualVialBackorderEnabled: true,
      })
      expect(getStorefrontAvailability(p, 'CASE')).toBe('OUT_OF_STOCK')
      expect(getStorefrontAvailability(p, 'INDIVIDUAL_VIAL')).toBe('BACKORDERED')
    })
  })
})

describe('isPurchasable', () => {
  it('AVAILABLE, LIMITED, and BACKORDERED are all purchasable', () => {
    expect(isPurchasable('AVAILABLE')).toBe(true)
    expect(isPurchasable('LIMITED')).toBe(true)
    expect(isPurchasable('BACKORDERED')).toBe(true)
  })

  it('OUT_OF_STOCK and COMING_SOON are never purchasable', () => {
    expect(isPurchasable('OUT_OF_STOCK')).toBe(false)
    expect(isPurchasable('COMING_SOON')).toBe(false)
  })
})

describe('AVAILABILITY_LABEL', () => {
  it('has a label for every availability state including BACKORDERED', () => {
    expect(AVAILABILITY_LABEL.BACKORDERED).toBe('⌛ Produced to Order')
  })

  it('shows a positive Ready to Ship label for AVAILABLE (2026-08-15 fulfillment sprint)', () => {
    expect(AVAILABILITY_LABEL.AVAILABLE).toBe('● Ready to Ship')
  })
})
