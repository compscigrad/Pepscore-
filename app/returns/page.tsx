// Returns & Refunds -- pre-launch REVIEWABLE DRAFT (2026-08-12 homepage
// revision pass #2, section 17). The owner has not finalized this policy;
// this is a reasonable starting proposal based on the current product
// model (research compounds, product-integrity constraints) and existing
// application behavior (Order/Invoice refund workflow, backorder
// compensation). Surfaced explicitly in the preview report for owner
// review, not silently established as final policy. Marked internally as
// OWNER REVIEW REQUIRED (docs/PendingOwnerActions.md).
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PolicyPageLayout, PolicyHeading } from '@/components/storefront/PolicyPageLayout'

export const metadata: Metadata = {
  title: 'Returns & Refunds | Pepscore Lab',
  description: 'Pepscore Lab Returns & Refunds policy.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/returns' },
}

export default function ReturnsPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <PolicyPageLayout title="Returns & Refunds" updated="August 12, 2026 (draft, pending final owner approval)">
        <PolicyHeading>Order Cancellation Before Fulfillment</PolicyHeading>
        <p>
          If your order has not yet shipped, contact us and we will cancel it and issue a full refund to your
          original payment method.
        </p>

        <PolicyHeading>Shipped Orders and Product Integrity</PolicyHeading>
        <p>
          Because Pepscore Lab products are research compounds supplied for laboratory use, we cannot accept returns
          of a shipped product once it has left our facility — we have no way to verify how it was stored or handled
          after it reaches you, and re-selling a returned research compound would compromise the integrity we
          guarantee to every other customer. This is a product-integrity limitation, not a reflection of the
          product&rsquo;s quality.
        </p>

        <PolicyHeading>Incorrect, Damaged, or Missing Shipments</PolicyHeading>
        <p>
          If you receive the wrong product, a damaged shipment, or your order never arrives, contact us within 7 days
          of the delivery date (or expected delivery date, for a missing shipment) with your order number. We will
          investigate and, where the issue is confirmed, provide a replacement or a refund to your original payment
          method.
        </p>

        <PolicyHeading>Refund Method</PolicyHeading>
        <p>
          Approved refunds are issued to the original payment method used at checkout. Refund processing times
          beyond that point depend on your bank or card issuer.
        </p>

        <PolicyHeading>Promotional Discounts</PolicyHeading>
        <p>
          A refund on an order that used a promotional or discount code reflects the amount actually paid, not the
          full undiscounted price. A one-time-use promotional code applied to a refunded order is not reissued.
        </p>

        <PolicyHeading>Backordered Items</PolicyHeading>
        <p>
          A qualifying backordered item on an order over $100 is automatically eligible for a $25 account credit
          under our existing backorder compensation policy, applied automatically once the backorder condition is
          recorded on your order — no request needed. This is separate from, and does not replace, the return/refund
          terms above.
        </p>

        <PolicyHeading>How to Request a Return or Refund</PolicyHeading>
        <p>
          Contact us at{' '}
          <a href="mailto:contact@pepscorelab.com" className="text-[#D4AF37] hover:underline">contact@pepscorelab.com</a>{' '}
          with your order number and a description of the issue, and we will respond with next steps.
        </p>

        <p className="text-white/40 text-[13px] italic">
          This page reflects a proposed policy pending final owner sign-off — see the accompanying preview report for
          exactly what to review before this is treated as final.
        </p>
      </PolicyPageLayout>
      <Footer />
    </>
  )
}
