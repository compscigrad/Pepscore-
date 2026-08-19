import { describe, it, expect } from 'vitest'
import { deriveReconciliationStatus, computeNetSettlement } from './stripeReconciliation'

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

describe('computeNetSettlement', () => {
  it('successful payment with a real Stripe fee, no refund -- net settlement is netAmount as-is', () => {
    // $50.00 gross, $1.75 real Stripe fee -> netAmount $48.25 (as Stripe's
    // own balance transaction would report it), no refund.
    expect(computeNetSettlement(50, 1.75, 48.25, 0)).toBe(48.25)
  })

  it('THE BUG THIS FIXES: a full refund must reduce net settlement to zero, not stay at the pre-refund netAmount', () => {
    // Before the fix, `p.netAmount || p.amount - p.stripeFee - p.refundedAmount`
    // used the truthy stored netAmount (48.25) as-is and never looked at
    // refundedAmount at all once netAmount was set -- which is every real
    // payment. A full $50 refund on this $50 charge must net to $0, not
    // silently report $48.25 as still settled.
    expect(computeNetSettlement(50, 1.75, 48.25, 50)).toBe(-1.75)
  })

  it('a partial refund reduces net settlement by exactly the refunded amount', () => {
    // $50 gross, $1.75 fee, netAmount $48.25, $20 partial refund.
    expect(computeNetSettlement(50, 1.75, 48.25, 20)).toBe(28.25)
  })

  it('falls back to amount - fee when netAmount is not set (0/falsy), still subtracting any refund', () => {
    expect(computeNetSettlement(50, 1.75, 0, 0)).toBe(48.25)
    expect(computeNetSettlement(50, 1.75, 0, 10)).toBe(38.25)
  })

  it('multiple independent payments each reconcile correctly when summed', () => {
    // Simulates the "multiple payments" scenario: two unrelated successful
    // payments, one of which later got a partial refund -- summed net
    // settlement must reflect both real amounts and the one refund.
    const paymentA = computeNetSettlement(100, 3.2, 96.8, 0) // no refund
    const paymentB = computeNetSettlement(60, 2.04, 57.96, 15) // $15 partial refund
    expect(paymentA).toBe(96.8)
    expect(paymentB).toBe(42.96)
    expect(paymentA + paymentB).toBeCloseTo(139.76, 2)
  })
})
