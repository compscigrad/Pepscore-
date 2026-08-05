import { describe, it, expect } from 'vitest'
import { computeFulfillmentEligibility } from './gate'

const base = {
  balanceDue: 100,
  hasActivePaymentArrangement: false,
  fulfillmentOverrideAt: null as Date | null,
  hasActiveBackorder: false,
}

describe('computeFulfillmentEligibility', () => {
  it('disallows when nothing applies', () => {
    expect(computeFulfillmentEligibility(base)).toEqual({ allowed: false })
  })

  it('allows when paid in full (balanceDue <= 0)', () => {
    expect(computeFulfillmentEligibility({ ...base, balanceDue: 0 })).toEqual({
      allowed: true,
      reason: 'PAID_IN_FULL',
    })
    expect(computeFulfillmentEligibility({ ...base, balanceDue: -0.01 })).toEqual({
      allowed: true,
      reason: 'PAID_IN_FULL',
    })
  })

  it('allows when an active payment arrangement exists, even with a balance due', () => {
    expect(computeFulfillmentEligibility({ ...base, hasActivePaymentArrangement: true })).toEqual({
      allowed: true,
      reason: 'ACTIVE_PAYMENT_ARRANGEMENT',
    })
  })

  it('allows when a manual override is on record, regardless of everything else', () => {
    expect(computeFulfillmentEligibility({ ...base, fulfillmentOverrideAt: new Date() })).toEqual({
      allowed: true,
      reason: 'MANUAL_OVERRIDE',
    })
  })

  it('prioritizes override over paid-in-full over active-arrangement when multiple are true', () => {
    expect(
      computeFulfillmentEligibility({
        balanceDue: 0,
        hasActivePaymentArrangement: true,
        fulfillmentOverrideAt: new Date(),
        hasActiveBackorder: false,
      })
    ).toEqual({ allowed: true, reason: 'MANUAL_OVERRIDE' })

    expect(
      computeFulfillmentEligibility({
        balanceDue: 0,
        hasActivePaymentArrangement: true,
        fulfillmentOverrideAt: null,
        hasActiveBackorder: false,
      })
    ).toEqual({ allowed: true, reason: 'PAID_IN_FULL' })
  })

  it('blocks fulfillment while an active backorder exists, even if paid in full or under an arrangement', () => {
    expect(computeFulfillmentEligibility({ ...base, hasActiveBackorder: true, balanceDue: 0 })).toEqual({
      allowed: false,
    })
    expect(
      computeFulfillmentEligibility({ ...base, hasActiveBackorder: true, hasActivePaymentArrangement: true })
    ).toEqual({ allowed: false })
  })

  it('still allows fulfillment through a manual override despite an active backorder', () => {
    expect(
      computeFulfillmentEligibility({
        ...base,
        hasActiveBackorder: true,
        fulfillmentOverrideAt: new Date(),
      })
    ).toEqual({ allowed: true, reason: 'MANUAL_OVERRIDE' })
  })
})
