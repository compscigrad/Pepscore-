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
