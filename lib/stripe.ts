// Stripe server-side client — lazy initialization
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY environment variable')
    _stripe = new Stripe(key)
  }
  return _stripe
}

// Convenience alias used throughout API routes
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})

// Published Stripe pricing constants -- exported (not just inlined into
// the two estimate functions below) so lib/payments/analytics.ts can
// compute "what would this ACH volume have cost as card" using the exact
// same numbers, rather than a second hardcoded copy that could drift.
export const STRIPE_CARD_FEE_PERCENT = 0.029
export const STRIPE_CARD_FEE_FIXED = 0.3
export const STRIPE_ACH_FEE_PERCENT = 0.008
export const STRIPE_ACH_FEE_CAP = 5

// Calculate Stripe fee (2.9% + $0.30 per successful charge)
export function estimateStripeFee(amount: number): number {
  return Math.round((amount * STRIPE_CARD_FEE_PERCENT + STRIPE_CARD_FEE_FIXED) * 100) / 100
}

// [Roadmap] ACH (Phase 2) -- Stripe's published ACH Direct Debit pricing:
// 0.8% per transaction, capped at $5. Kept separate from
// estimateStripeFee() rather than a shared "estimateFee(methodType)"
// switch, since the two pricing shapes (percent+fixed vs percent-with-cap)
// don't share a formula -- this is the internal-cost-tracking side (owner
// spec item 3): the customer is never shown or charged this, it's what
// Payment.processorFeePercent/processorFeeFixed/estimateAchFee's result
// get compared against in admin cost-analytics reporting.
export function estimateAchFee(amount: number): number {
  return Math.round(Math.min(amount * STRIPE_ACH_FEE_PERCENT, STRIPE_ACH_FEE_CAP) * 100) / 100
}

export interface RealStripeFee {
  fee: number
  net: number
  balanceTransactionId: string
}

// 2026-08-19 Stripe fee-reconciliation hardening -- the actual processing
// fee Stripe charged, read from the real balance transaction on the
// PaymentIntent's charge, never estimated from the published rate.
// Stripe computes and attaches balance_transaction synchronously when a
// charge succeeds, so by the time checkout.session.completed/
// async_payment_succeeded fires this is normally already available; the
// try/catch exists for the rare case it isn't yet (or the API call
// itself fails), matching this file's neighboring fetchAchDetails()
// convention in app/api/webhooks/stripe/route.ts: never throws, caller
// falls back to the published-rate estimate and marks the row
// stripeFeeIsEstimated: true rather than blocking the payment lifecycle
// on a processing-fee lookup.
export async function getRealStripeFee(paymentIntentId: string): Promise<RealStripeFee | null> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.balance_transaction'] })
    const charge = pi.latest_charge
    if (!charge || typeof charge === 'string') return null
    const bt = charge.balance_transaction
    if (!bt || typeof bt === 'string') return null
    return { fee: bt.fee / 100, net: bt.net / 100, balanceTransactionId: bt.id }
  } catch (err) {
    console.error('[getRealStripeFee] Failed to retrieve real Stripe balance transaction:', err)
    return null
  }
}

export interface ResolvedPaymentFee {
  fee: number
  net: number
  stripeFeeIsEstimated: boolean
}

// Pure -- exported for unit testing. The single place markOrderPaid()'s
// "use the real Stripe fee when we have it, fall back to the published
// rate otherwise" decision lives, so the fallback logic is directly
// testable without a database or a live Stripe call.
export function resolvePaymentFee(real: RealStripeFee | null, methodType: 'CARD' | 'ACH', amountTotal: number): ResolvedPaymentFee {
  if (real) return { fee: real.fee, net: real.net, stripeFeeIsEstimated: false }
  const fee = methodType === 'ACH' ? estimateAchFee(amountTotal) : estimateStripeFee(amountTotal)
  return { fee, net: amountTotal - fee, stripeFeeIsEstimated: true }
}
