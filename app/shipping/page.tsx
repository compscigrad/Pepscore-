// Shipping Policy -- built around the owner-specified baseline and the
// actual implemented fulfillment/tracking architecture (2026-08-12
// homepage revision pass #2, section 18). Uses "typically"/"estimated"
// language rather than promising fixed delivery dates; no cold-chain
// claim (products ship lyophilized). Marked internally as OWNER REVIEW
// REQUIRED (docs/PendingOwnerActions.md).
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PolicyPageLayout, PolicyHeading } from '@/components/storefront/PolicyPageLayout'

export const metadata: Metadata = {
  title: 'Shipping Policy | Pepscore Lab',
  description: 'Pepscore Lab Shipping Policy.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/shipping' },
}

export default function ShippingPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <PolicyPageLayout title="Shipping Policy" updated="August 12, 2026">
        <PolicyHeading>Processing &amp; Delivery Estimates</PolicyHeading>
        <p>
          Most in-stock orders are processed and ship within approximately 2–5 business days. Delivery time beyond
          that depends on the shipping method selected and your location. These are estimates, not guaranteed
          delivery dates.
        </p>

        <PolicyHeading>Backordered Items</PolicyHeading>
        <p>
          An item that&rsquo;s temporarily out of stock but backorder-eligible typically ships within approximately 2
          weeks once restocked. A qualifying backordered item on an order over $100 automatically receives a $25
          account credit under our existing compensation policy — see{' '}
          <a href="/returns" className="text-[#D4AF37] hover:underline">Returns &amp; Refunds</a>.
        </p>

        <PolicyHeading>Product Packaging</PolicyHeading>
        <p>
          Pepscore Lab products ship lyophilized (freeze-dried), which is shelf-stable at room temperature during
          transit — our current fulfillment workflow does not require cold-chain or refrigerated shipping.
        </p>

        <PolicyHeading>Tracking</PolicyHeading>
        <p>
          Every order is tracked through our fulfillment system. If you have a Customer Portal account and are
          signed in, you can follow your order&rsquo;s tracking status directly from your account. Guest customers
          receive tracking information by email as it becomes available.
        </p>

        <PolicyHeading>Shipping Issues</PolicyHeading>
        <p>
          If your tracking shows an issue, or your order hasn&rsquo;t arrived within a reasonable window past the
          estimate above, contact us at{' '}
          <a href="mailto:contact@pepscorelab.com" className="text-[#D4AF37] hover:underline">contact@pepscorelab.com</a>{' '}
          with your order number.
        </p>
      </PolicyPageLayout>
      <Footer />
    </>
  )
}
