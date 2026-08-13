import { describe, it, expect } from 'vitest'
import { deriveInventoryLossCostBasis } from './reports'

describe('deriveInventoryLossCostBasis', () => {
  it('computes cost basis from supplier case cost and units per case, never retail value', () => {
    // $500/case, 10 units/case -> $50/unit; 3 units lost -> $150
    expect(deriveInventoryLossCostBasis(3, 500, 10)).toBe(150)
  })

  it('returns null (unknown) when supplierCaseCost is missing, never $0', () => {
    expect(deriveInventoryLossCostBasis(3, null, 10)).toBeNull()
  })

  it('returns null (unknown) when unitsPerCase is missing', () => {
    expect(deriveInventoryLossCostBasis(3, 500, null)).toBeNull()
  })

  it('returns null when unitsPerCase is zero or negative (guards a divide-by-zero)', () => {
    expect(deriveInventoryLossCostBasis(3, 500, 0)).toBeNull()
  })
})
