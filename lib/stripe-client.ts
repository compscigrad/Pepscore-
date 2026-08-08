// Client-side Stripe.js loader for the embedded checkout UI
// (components/storefront/CheckoutForm.tsx). Publishable key only -- never
// the secret key, which stays server-only (lib/stripe.ts).
import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripeClient(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    stripePromise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return stripePromise
}
