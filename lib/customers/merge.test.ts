import { describe, it, expect } from 'vitest'
import { detectMergeConflicts } from './merge'

const NO_CONFLICT_INPUT = {
  survivorUserId: null,
  loserUserId: null,
  survivorStripeCustomerId: null,
  loserStripeCustomerId: null,
  survivorHasFirstOrderClaim: false,
  loserHasFirstOrderClaim: false,
}

describe('detectMergeConflicts', () => {
  it('returns no conflicts when neither record has any identity-defining data', () => {
    expect(detectMergeConflicts(NO_CONFLICT_INPUT)).toEqual([])
  })

  it('returns no conflicts when only one record has a linked portal account', () => {
    expect(detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorUserId: 'user_1' })).toEqual([])
    expect(detectMergeConflicts({ ...NO_CONFLICT_INPUT, loserUserId: 'user_1' })).toEqual([])
  })

  it('flags a conflict when both records are linked to different portal accounts', () => {
    const conflicts = detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorUserId: 'user_1', loserUserId: 'user_2' })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].reason).toBe('BOTH_HAVE_LINKED_PORTAL_ACCOUNTS')
  })

  it('does not flag a conflict when both records are somehow already linked to the SAME user id', () => {
    // Should be structurally impossible (Customer.userId is @unique), but
    // the pure function itself should still not misreport this as a real
    // conflict if it ever happens.
    expect(detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorUserId: 'user_1', loserUserId: 'user_1' })).toEqual([])
  })

  it('flags a conflict when both records have different Stripe customer ids', () => {
    const conflicts = detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorStripeCustomerId: 'cus_1', loserStripeCustomerId: 'cus_2' })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].reason).toBe('BOTH_HAVE_STRIPE_CUSTOMER_IDS')
  })

  it('does not flag a conflict when only one record has a Stripe customer id', () => {
    expect(detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorStripeCustomerId: 'cus_1' })).toEqual([])
  })

  it('flags a conflict when both records have already claimed a first-order offer', () => {
    const conflicts = detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorHasFirstOrderClaim: true, loserHasFirstOrderClaim: true })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].reason).toBe('BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS')
  })

  it('does not flag a conflict when only one record has claimed a first-order offer', () => {
    expect(detectMergeConflicts({ ...NO_CONFLICT_INPUT, survivorHasFirstOrderClaim: true })).toEqual([])
  })

  it('returns every applicable conflict at once, not just the first one found', () => {
    const conflicts = detectMergeConflicts({
      survivorUserId: 'user_1',
      loserUserId: 'user_2',
      survivorStripeCustomerId: 'cus_1',
      loserStripeCustomerId: 'cus_2',
      survivorHasFirstOrderClaim: true,
      loserHasFirstOrderClaim: true,
    })
    expect(conflicts).toHaveLength(3)
    expect(conflicts.map((c) => c.reason).sort()).toEqual(
      ['BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS', 'BOTH_HAVE_LINKED_PORTAL_ACCOUNTS', 'BOTH_HAVE_STRIPE_CUSTOMER_IDS'].sort()
    )
  })

  it('every conflict includes a non-empty, actionable message', () => {
    const conflicts = detectMergeConflicts({
      survivorUserId: 'user_1',
      loserUserId: 'user_2',
      survivorStripeCustomerId: 'cus_1',
      loserStripeCustomerId: 'cus_2',
      survivorHasFirstOrderClaim: true,
      loserHasFirstOrderClaim: true,
    })
    for (const c of conflicts) {
      expect(c.message.length).toBeGreaterThan(20)
    }
  })
})
