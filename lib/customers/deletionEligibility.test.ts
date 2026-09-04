import { describe, it, expect } from 'vitest'
import { computeCustomerDeletionEligibility, type CustomerDeletionFlags } from './deletionEligibility'

const cleanFlags: CustomerDeletionFlags = {
  invoiceCount: 0,
  orderCount: 0,
  accountCreditCount: 0,
  savedPaymentMethodCount: 0,
  priceMatchAuthorizationCount: 0,
  professionalAccessCount: 0,
  professionalEvaluationCount: 0,
  redeemedPromotionCount: 0,
}

describe('computeCustomerDeletionEligibility', () => {
  it('a test customer / duplicate / abandoned lead with zero history is eligible', () => {
    expect(computeCustomerDeletionEligibility(cleanFlags)).toEqual([])
  })

  it('blocks on any invoice', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, invoiceCount: 1 })).toContain('HAS_INVOICES')
  })

  it('blocks on a storefront order', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, orderCount: 1 })).toContain('HAS_STOREFRONT_ORDERS')
  })

  it('blocks on account credit history', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, accountCreditCount: 1 })).toContain('HAS_ACCOUNT_CREDITS')
  })

  it('blocks on a saved payment method', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, savedPaymentMethodCount: 1 })).toContain('HAS_SAVED_PAYMENT_METHODS')
  })

  it('blocks on an approved Price Match authorization', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, priceMatchAuthorizationCount: 1 })).toContain('HAS_PRICE_MATCH_AUTHORIZATIONS')
  })

  it('blocks on Professional Access history', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, professionalAccessCount: 1 })).toContain('HAS_PROFESSIONAL_ACCESS')
  })

  it('blocks on a Professional evaluation record', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, professionalEvaluationCount: 1 })).toContain('HAS_PROFESSIONAL_EVALUATIONS')
  })

  it('blocks on a redeemed promotion', () => {
    expect(computeCustomerDeletionEligibility({ ...cleanFlags, redeemedPromotionCount: 1 })).toContain('HAS_REDEEMED_PROMOTIONS')
  })

  it('returns every applicable reason at once, not just the first', () => {
    const reasons = computeCustomerDeletionEligibility({ ...cleanFlags, invoiceCount: 3, accountCreditCount: 1 })
    expect(reasons).toEqual(expect.arrayContaining(['HAS_INVOICES', 'HAS_ACCOUNT_CREDITS']))
    expect(reasons).toHaveLength(2)
  })
})
