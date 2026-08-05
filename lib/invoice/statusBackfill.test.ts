import { describe, it, expect } from 'vitest'
import { computeBackfilledStatus } from './statusBackfill'

describe('computeBackfilledStatus', () => {
  it('preserves DRAFT regardless of balance due', () => {
    expect(computeBackfilledStatus({ status: 'DRAFT', balanceDue: 500 })).toBe('DRAFT')
    expect(computeBackfilledStatus({ status: 'DRAFT', balanceDue: 0 })).toBe('DRAFT')
  })

  it('preserves terminal statuses (CANCELLED, REFUNDED, VOID) regardless of balance due', () => {
    expect(computeBackfilledStatus({ status: 'CANCELLED', balanceDue: 250 })).toBe('CANCELLED')
    expect(computeBackfilledStatus({ status: 'REFUNDED', balanceDue: 100 })).toBe('REFUNDED')
    expect(computeBackfilledStatus({ status: 'VOID', balanceDue: 75 })).toBe('VOID')
  })

  it('moves an issued invoice with an unpaid balance to PENDING', () => {
    expect(computeBackfilledStatus({ status: 'ISSUED', balanceDue: 439 })).toBe('PENDING')
  })

  it('moves a legacy PARTIALLY_PAID invoice with a remaining balance to PENDING', () => {
    expect(computeBackfilledStatus({ status: 'PARTIALLY_PAID', balanceDue: 214 })).toBe('PENDING')
  })

  it('leaves already-correct rows unchanged (idempotent)', () => {
    // Already PENDING with a balance -- correct, no change proposed.
    expect(computeBackfilledStatus({ status: 'PENDING', balanceDue: 100 })).toBe('PENDING')
    // ISSUED with a zero balance -- correct (paid off, not yet delivered), no change.
    expect(computeBackfilledStatus({ status: 'ISSUED', balanceDue: 0 })).toBe('ISSUED')
  })
})
