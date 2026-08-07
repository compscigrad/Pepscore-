import { describe, it, expect } from 'vitest'
import { computeInventoryStatus, computeAvailableUnits, computeCompleteCasesAvailable } from './status'

describe('computeInventoryStatus', () => {
  it('is TRACKING_DISABLED when tracking is off, regardless of stock fields', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: false, physicalStockOnHand: 100, reservedUnits: 0, lowStockThreshold: 10 })).toBe('TRACKING_DISABLED')
  })

  it('is AWAITING_INITIALIZATION when tracking is on but no opening count has been supplied', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: null, reservedUnits: 0, lowStockThreshold: 10 })).toBe('AWAITING_INITIALIZATION')
  })

  it('is IN_STOCK when available is above the threshold', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: 100, reservedUnits: 10, lowStockThreshold: 20 })).toBe('IN_STOCK')
  })

  it('is LOW_STOCK when available is at or below the threshold but still positive', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: 30, reservedUnits: 10, lowStockThreshold: 20 })).toBe('LOW_STOCK')
  })

  it('is OUT_OF_STOCK when available is zero', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: 10, reservedUnits: 10, lowStockThreshold: 20 })).toBe('OUT_OF_STOCK')
  })

  it('is OUT_OF_STOCK (not a crash) when reservations exceed physical stock', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: 5, reservedUnits: 8, lowStockThreshold: 2 })).toBe('OUT_OF_STOCK')
  })

  it('treats a null threshold as "no low-stock alerting configured" -- IN_STOCK whenever available > 0', () => {
    expect(computeInventoryStatus({ inventoryTrackingEnabled: true, physicalStockOnHand: 1, reservedUnits: 0, lowStockThreshold: null })).toBe('IN_STOCK')
  })
})

describe('computeAvailableUnits', () => {
  it('returns null when not yet initialized', () => {
    expect(computeAvailableUnits(null, 0)).toBeNull()
  })
  it('subtracts reserved from physical stock', () => {
    expect(computeAvailableUnits(50, 12)).toBe(38)
  })
})

describe('computeCompleteCasesAvailable', () => {
  it('returns null when not yet initialized or unitsPerCase unset', () => {
    expect(computeCompleteCasesAvailable(null, 0, 10)).toBeNull()
    expect(computeCompleteCasesAvailable(50, 0, null)).toBeNull()
  })
  it('floors partial cases', () => {
    expect(computeCompleteCasesAvailable(95, 5, 10)).toBe(9)
  })
  it('returns 0 rather than a negative number of cases when reservations exceed stock', () => {
    expect(computeCompleteCasesAvailable(5, 8, 10)).toBe(0)
  })
})
