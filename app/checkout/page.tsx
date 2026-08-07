// Server-side gate for the checkout page -- the client CheckoutForm below is
// never even sent to the browser while real payments are disabled, so a
// disabled storefront has no reachable path to /api/checkout at all (which
// is itself also gated, in case this ever changes). See
// lib/storefront/checkoutGate.ts.
import { isStorefrontCheckoutEnabled } from '@/lib/storefront/checkoutGate'
import { CheckoutForm } from '@/components/storefront/CheckoutForm'
import { CheckoutComingSoon } from '@/components/storefront/CheckoutComingSoon'

// Evaluate the kill switch on every request rather than baking it into a
// statically-generated page at build time -- flipping the env var in Vercel
// must take effect without depending on whether/when the next redeploy
// happens to regenerate a static HTML snapshot.
export const dynamic = 'force-dynamic'

export default function CheckoutPage() {
  if (!isStorefrontCheckoutEnabled()) {
    return <CheckoutComingSoon />
  }
  return <CheckoutForm />
}
