import { describe, it, expect } from 'vitest'
import { deriveReconciliationStatus } from './stripeReconciliation'

describe('deriveReconciliationStatus', () => {
  it('returns MATCHED for a settled payment whose amount equals the order total', () => {
    expect(deriveReconciliationStatus(100, 100, 'SUCCEEDED', new Date())).toBe('MATCHED')
  })

  it('returns PENDING for a settled-amount match with no settledAt yet', () => {
    expect(deriveReconciliationStatus(100, 100, 'SUCCEEDED', null)).toBe('PENDING')
  })

  it('returns PENDING for a processing/authorized/pending payment regardless of amount', () => {
    expect(deriveReconciliationStatus(100, 100, 'PENDING', null)).toBe('PENDING')
    expect(deriveReconciliationStatus(100, 100, 'PROCESSING', null)).toBe('PENDING')
    expect(deriveReconciliationStatus(100, 100, 'AUTHORIZED', null)).toBe('PENDING')
  })

  it('returns NOT_AVAILABLE for a failed payment', () => {
    expect(deriveReconciliationStatus(100, 0, 'FAILED', null)).toBe('NOT_AVAILABLE')
  })

  it('returns MISMATCH when the amounts differ by more than a cent of float slack', () => {
    expect(deriveReconciliationStatus(100, 90, 'SUCCEEDED', new Date())).toBe('MISMATCH')
  })

  it('tolerates a sub-cent float rounding difference as still MATCHED', () => {
    expect(deriveReconciliationStatus(100, 100.001, 'SUCCEEDED', new Date())).toBe('MATCHED')
  })

  it('returns PARTIAL for a partially refunded payment with amounts still matching', () => {
    expect(deriveReconciliationStatus(100, 100, 'PARTIALLY_REFUNDED', new Date())).toBe('PARTIAL')
  })

  it('a real mismatch is reported even for a partially refunded payment', () => {
    expect(deriveReconciliationStatus(100, 50, 'PARTIALLY_REFUNDED', new Date())).toBe('MISMATCH')
  })
})
