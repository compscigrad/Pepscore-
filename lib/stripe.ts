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

// Calculate Stripe fee (2.9% + $0.30 per successful charge)
export function estimateStripeFee(amount: number): number {
  return Math.round((amount * 0.029 + 0.30) * 100) / 100
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
  return Math.round(Math.min(amount * 0.008, 5) * 100) / 100
}
