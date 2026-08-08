// [Roadmap] Payment-provider abstraction, Phase 1. Mirrors the existing
// ShippingProvider precedent (lib/tracking/shippoProvider.ts, see
// docs/Decisions.md #22): a small interface today's one real provider
// (Stripe) implements, so a second provider (ACH via GoCardless, PayPal)
// is a new file implementing the same interface rather than new branches
// scattered through webhook/checkout code. Nothing outside lib/payments/**
// should import a provider-specific type (Stripe.Event, etc.) directly --
// route handlers and business logic work only in these normalized shapes.
import type { PaymentProvider, PaymentStatus, StorefrontPaymentMethodType } from '@prisma/client'

export type NormalizedPaymentStatus = PaymentStatus

// What actually happened, extracted from a provider's webhook payload.
// `providerTransactionId` is always the value app/api/webhooks/stripe's
// existing stripePaymentIntentId lookup already keys off of (a Stripe
// PaymentIntent id) -- kept as the join key here too so today's Payment
// row is always found the same way it already is, provider-abstraction or
// not.
export interface NormalizedPaymentEvent {
  provider: PaymentProvider
  providerTransactionId: string
  status: NormalizedPaymentStatus
  methodType?: StorefrontPaymentMethodType
  /** Dollars, when the event carries a definite total (e.g. a completed checkout). */
  amount?: number
  /** Cumulative refunded amount in dollars, when the event is refund-related. */
  refundedAmount?: number
  occurredAt: Date
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider
  /**
   * Turn one provider-specific webhook event into zero-or-one normalized
   * events. Returns null for event types this adapter doesn't (yet) map --
   * callers must treat null as "no-op," never as an error, since a
   * provider's webhook stream always includes event types no consumer
   * cares about.
   */
  normalizeWebhookEvent(rawEvent: unknown): NormalizedPaymentEvent | null
}
