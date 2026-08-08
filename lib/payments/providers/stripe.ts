// The one real PaymentProviderAdapter implementation today. Wraps the
// EXISTING lib/stripe.ts client (unchanged) -- this file adds a
// normalization layer on top of real Stripe webhook events, it doesn't
// replace how Stripe itself is called for checkout or webhook signature
// verification (still app/api/checkout/route.ts and
// app/api/webhooks/stripe/route.ts, same as before this PR).
import type Stripe from 'stripe'
import type { NormalizedPaymentEvent, PaymentProviderAdapter } from '../types'

function isStripeEvent(value: unknown): value is Stripe.Event {
  return !!value && typeof value === 'object' && 'type' in value && 'data' in value
}

// Real Stripe event -> normalized shape. Every case below maps an event
// this codebase has actually seen fields for; unmapped event types
// (there are dozens in Stripe's full catalog) fall through to null, which
// callers treat as "nothing to do," not an error -- Stripe delivers every
// subscribed event type regardless of whether a given integration cares
// about all of them.
export function normalizeStripeEvent(rawEvent: unknown): NormalizedPaymentEvent | null {
  if (!isStripeEvent(rawEvent)) return null
  const event = rawEvent
  const occurredAt = new Date(event.created * 1000)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentIntentId = session.payment_intent as string | null
      if (!paymentIntentId) return null
      // 'paid' -- a synchronous method (card) settled immediately. 'unpaid'
      // -- an async method (ACH) is still processing; Stripe's own
      // recommended pattern is to wait for checkout.session.async_payment_
      // succeeded/failed rather than treat session completion itself as
      // payment received. 'no_payment_required' doesn't apply to this
      // codebase's paid-cart checkout, so it's treated as PROCESSING too
      // (never silently as SUCCEEDED) if it's ever seen.
      return {
        provider: 'STRIPE',
        providerTransactionId: paymentIntentId,
        status: session.payment_status === 'paid' ? 'SUCCEEDED' : 'PROCESSING',
        methodType: session.payment_status === 'paid' ? 'CARD' : 'ACH',
        amount: (session.amount_total ?? 0) / 100,
        occurredAt,
      }
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentIntentId = session.payment_intent as string | null
      if (!paymentIntentId) return null
      return {
        provider: 'STRIPE',
        providerTransactionId: paymentIntentId,
        status: 'SUCCEEDED',
        methodType: 'ACH',
        amount: (session.amount_total ?? 0) / 100,
        occurredAt,
      }
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentIntentId = session.payment_intent as string | null
      if (!paymentIntentId) return null
      return { provider: 'STRIPE', providerTransactionId: paymentIntentId, status: 'FAILED', methodType: 'ACH', occurredAt }
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      return { provider: 'STRIPE', providerTransactionId: pi.id, status: 'FAILED', occurredAt }
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object as Stripe.PaymentIntent
      return { provider: 'STRIPE', providerTransactionId: pi.id, status: 'CANCELLED', occurredAt }
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const paymentIntentId = charge.payment_intent as string | null
      if (!paymentIntentId) return null
      const refundedAmount = (charge.amount_refunded ?? 0) / 100
      const totalAmount = (charge.amount ?? 0) / 100
      const isFullRefund = charge.amount_refunded >= charge.amount
      return {
        provider: 'STRIPE',
        providerTransactionId: paymentIntentId,
        status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        amount: totalAmount,
        refundedAmount,
        occurredAt,
      }
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute
      const paymentIntentId = dispute.payment_intent as string | null
      if (!paymentIntentId) return null
      return { provider: 'STRIPE', providerTransactionId: paymentIntentId, status: 'DISPUTED', occurredAt }
    }

    default:
      return null
  }
}

export const stripePaymentProvider: PaymentProviderAdapter = {
  provider: 'STRIPE',
  normalizeWebhookEvent: normalizeStripeEvent,
}
