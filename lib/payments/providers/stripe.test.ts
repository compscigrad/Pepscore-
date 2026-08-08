import { describe, expect, it } from 'vitest'
import { normalizeStripeEvent } from './stripe'

function makeEvent(type: string, data: Record<string, unknown>) {
  return { type, created: 1700000000, data: { object: data } }
}

describe('normalizeStripeEvent', () => {
  it('normalizes checkout.session.completed into SUCCEEDED', () => {
    const result = normalizeStripeEvent(
      makeEvent('checkout.session.completed', { payment_intent: 'pi_123', amount_total: 4999 })
    )
    expect(result).toEqual({
      provider: 'STRIPE',
      providerTransactionId: 'pi_123',
      status: 'SUCCEEDED',
      methodType: 'CARD',
      amount: 49.99,
      occurredAt: new Date(1700000000 * 1000),
    })
  })

  it('returns null for checkout.session.completed with no payment_intent', () => {
    expect(normalizeStripeEvent(makeEvent('checkout.session.completed', { payment_intent: null }))).toBeNull()
  })

  it('normalizes payment_intent.payment_failed into FAILED', () => {
    const result = normalizeStripeEvent(makeEvent('payment_intent.payment_failed', { id: 'pi_456' }))
    expect(result?.status).toBe('FAILED')
    expect(result?.providerTransactionId).toBe('pi_456')
  })

  it('normalizes payment_intent.canceled into CANCELLED', () => {
    const result = normalizeStripeEvent(makeEvent('payment_intent.canceled', { id: 'pi_789' }))
    expect(result?.status).toBe('CANCELLED')
  })

  it('normalizes a full charge.refunded into REFUNDED', () => {
    const result = normalizeStripeEvent(
      makeEvent('charge.refunded', { payment_intent: 'pi_full', amount: 5000, amount_refunded: 5000 })
    )
    expect(result).toMatchObject({ status: 'REFUNDED', amount: 50, refundedAmount: 50 })
  })

  it('normalizes a partial charge.refunded into PARTIALLY_REFUNDED', () => {
    const result = normalizeStripeEvent(
      makeEvent('charge.refunded', { payment_intent: 'pi_partial', amount: 5000, amount_refunded: 2000 })
    )
    expect(result).toMatchObject({ status: 'PARTIALLY_REFUNDED', amount: 50, refundedAmount: 20 })
  })

  it('returns null for charge.refunded with no payment_intent', () => {
    expect(normalizeStripeEvent(makeEvent('charge.refunded', { payment_intent: null, amount: 100, amount_refunded: 100 }))).toBeNull()
  })

  it('normalizes charge.dispute.created into DISPUTED', () => {
    const result = normalizeStripeEvent(makeEvent('charge.dispute.created', { payment_intent: 'pi_disputed' }))
    expect(result).toMatchObject({ status: 'DISPUTED', providerTransactionId: 'pi_disputed' })
  })

  it('returns null for an unmapped event type', () => {
    expect(normalizeStripeEvent(makeEvent('customer.created', {}))).toBeNull()
  })

  it('returns null for a non-event value', () => {
    expect(normalizeStripeEvent(null)).toBeNull()
    expect(normalizeStripeEvent('not an event')).toBeNull()
    expect(normalizeStripeEvent({})).toBeNull()
  })
})
