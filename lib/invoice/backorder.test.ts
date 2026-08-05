import { describe, it, expect } from 'vitest'
import {
  computeCompensationSplit,
  decideCompensationDisposition,
  isDeliveryStatusBlockedByBackorder,
  isTrackingBlockedByBackorder,
  canTransitionRefundStatus,
} from './backorder'

describe('computeCompensationSplit', () => {
  it('applies the full amount as a credit when the balance due covers it', () => {
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 100, amountPaid: 0 })).toEqual({
      creditAppliedAmount: 25,
      refundAmount: 0,
      accountCreditAmount: 0,
    })
  })

  it('caps the credit at balanceDue when less than $25 remains due, and refunds the rest from what was paid', () => {
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 10, amountPaid: 90 })).toEqual({
      creditAppliedAmount: 10,
      refundAmount: 15,
      accountCreditAmount: 0,
    })
  })

  it('refunds the full amount when the invoice is fully paid (balanceDue = 0)', () => {
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 0, amountPaid: 100 })).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 25,
      accountCreditAmount: 0,
    })
  })

  it('never treats a negative/overpaid balanceDue as owed money to discount', () => {
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: -5, amountPaid: 105 })).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 25,
      accountCreditAmount: 0,
    })
  })

  it('falls back to account credit when the remainder exceeds what was actually collected', () => {
    // e.g. a $25 compensation on an invoice whose total (and amountPaid) was only $10
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 0, amountPaid: 10 })).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 10,
      accountCreditAmount: 15,
    })
  })

  it('splits three ways when balanceDue is small, amountPaid is small, and compensation exceeds both', () => {
    // total invoice was $12: $2 balance due, $10 already paid
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 2, amountPaid: 10 })).toEqual({
      creditAppliedAmount: 2,
      refundAmount: 10,
      accountCreditAmount: 13,
    })
  })

  it('rounds to the nearest cent', () => {
    const result = computeCompensationSplit({ compensationAmount: 25, balanceDue: 10.005, amountPaid: 0 })
    expect(result.creditAppliedAmount).toBe(10.01)
  })

  it('defaults to the REFUND preference when none is given', () => {
    expect(computeCompensationSplit({ compensationAmount: 25, balanceDue: 0, amountPaid: 100 })).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 25,
      accountCreditAmount: 0,
    })
  })

  it('ACCOUNT_CREDIT preference sends the entire remainder to account credit, never creating a refund', () => {
    expect(
      computeCompensationSplit({ compensationAmount: 25, balanceDue: 0, amountPaid: 100, preference: 'ACCOUNT_CREDIT' })
    ).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 0,
      accountCreditAmount: 25,
    })
  })

  it('ACCOUNT_CREDIT preference still applies the discount portion first when balance is owed', () => {
    expect(
      computeCompensationSplit({ compensationAmount: 25, balanceDue: 10, amountPaid: 90, preference: 'ACCOUNT_CREDIT' })
    ).toEqual({
      creditAppliedAmount: 10,
      refundAmount: 0,
      accountCreditAmount: 15,
    })
  })

  it('REFUND preference still caps the refund at amountPaid and pushes any further excess to account credit (the combination case)', () => {
    expect(
      computeCompensationSplit({ compensationAmount: 25, balanceDue: 0, amountPaid: 10, preference: 'REFUND' })
    ).toEqual({
      creditAppliedAmount: 0,
      refundAmount: 10,
      accountCreditAmount: 15,
    })
  })

  it('never creates a refund when the remainder is fully absorbed by the discount, regardless of preference', () => {
    expect(
      computeCompensationSplit({ compensationAmount: 25, balanceDue: 100, amountPaid: 0, preference: 'ACCOUNT_CREDIT' })
    ).toEqual({
      creditAppliedAmount: 25,
      refundAmount: 0,
      accountCreditAmount: 0,
    })
  })
})

describe('decideCompensationDisposition', () => {
  it('creates a new compensation with the computed split when none exists yet for this invoice', () => {
    const result = decideCompensationDisposition({
      existingCompensationId: null,
      compensationAmount: 25,
      balanceDue: 100,
      amountPaid: 0,
    })
    expect(result).toEqual({
      kind: 'CREATE_NEW',
      split: { creditAppliedAmount: 25, refundAmount: 0, accountCreditAmount: 0 },
    })
  })

  it('links to the existing compensation instead of creating a second one, regardless of payment state', () => {
    const result = decideCompensationDisposition({
      existingCompensationId: 'comp_123',
      compensationAmount: 25,
      balanceDue: 0,
      amountPaid: 100,
    })
    expect(result).toEqual({ kind: 'LINK_EXISTING', compensationId: 'comp_123' })
  })
})

describe('isDeliveryStatusBlockedByBackorder', () => {
  const base = {
    hasActiveBackorder: true,
    fulfillmentOverrideAt: null as Date | null,
  }

  it('blocks SHIPPED while an active backorder exists', () => {
    expect(isDeliveryStatusBlockedByBackorder({ ...base, newDeliveryStatus: 'SHIPPED' })).toBe(true)
  })

  it('blocks IN_TRANSIT and DELIVERED while an active backorder exists', () => {
    expect(isDeliveryStatusBlockedByBackorder({ ...base, newDeliveryStatus: 'IN_TRANSIT' })).toBe(true)
    expect(isDeliveryStatusBlockedByBackorder({ ...base, newDeliveryStatus: 'DELIVERED' })).toBe(true)
  })

  it('allows PREPARING and PACKED even while an active backorder exists', () => {
    expect(isDeliveryStatusBlockedByBackorder({ ...base, newDeliveryStatus: 'PREPARING' })).toBe(false)
    expect(isDeliveryStatusBlockedByBackorder({ ...base, newDeliveryStatus: 'PACKED' })).toBe(false)
  })

  it('allows any status once there is no active backorder', () => {
    expect(
      isDeliveryStatusBlockedByBackorder({ ...base, hasActiveBackorder: false, newDeliveryStatus: 'SHIPPED' })
    ).toBe(false)
  })

  it('allows shipment progression through an attributed fulfillment override, even with an active backorder', () => {
    expect(
      isDeliveryStatusBlockedByBackorder({
        ...base,
        newDeliveryStatus: 'SHIPPED',
        fulfillmentOverrideAt: new Date(),
      })
    ).toBe(false)
  })
})

describe('isTrackingBlockedByBackorder', () => {
  it('blocks adding tracking while an active backorder exists', () => {
    expect(isTrackingBlockedByBackorder({ hasActiveBackorder: true, fulfillmentOverrideAt: null })).toBe(true)
  })

  it('allows adding tracking once there is no active backorder', () => {
    expect(isTrackingBlockedByBackorder({ hasActiveBackorder: false, fulfillmentOverrideAt: null })).toBe(false)
  })

  it('allows adding tracking through an attributed fulfillment override, even with an active backorder', () => {
    expect(isTrackingBlockedByBackorder({ hasActiveBackorder: true, fulfillmentOverrideAt: new Date() })).toBe(false)
  })
})

describe('canTransitionRefundStatus', () => {
  it('allows transitions from every non-terminal status', () => {
    expect(canTransitionRefundStatus('PENDING')).toBe(true)
    expect(canTransitionRefundStatus('AWAITING_MANUAL_PROCESSING')).toBe(true)
    expect(canTransitionRefundStatus('PROCESSING')).toBe(true)
  })

  it('blocks transitions from every terminal status — prevents completing/failing/cancelling twice', () => {
    expect(canTransitionRefundStatus('COMPLETED')).toBe(false)
    expect(canTransitionRefundStatus('FAILED')).toBe(false)
    expect(canTransitionRefundStatus('CANCELLED')).toBe(false)
  })
})
