// [Roadmap] Payment-change safety. Audited before writing any code: a
// storefront Order's total/line items are fixed at checkout-creation time
// and nothing in this codebase mutates them afterward (confirmed via a
// full grep of every prisma.order.update/orderItem.update call site --
// admin order updates only touch status/notes, shipping-label purchase
// only touches shippingCost/fulfillmentStatus post-payment). So a
// completed or in-progress embedded Checkout Session can never go stale
// through the Order side.
//
// The real (narrow but genuine) gap: app/api/checkout/route.ts creates
// the linked Invoice as DRAFT in the SAME transaction as the Order,
// before the Stripe Checkout Session is even created -- meaning that
// DRAFT invoice is a normal row in the admin invoice system for the
// entire time a customer is filling out the embedded Checkout form. If
// an admin applies or adjusts a backorder compensation (automatic or
// discretionary) against that invoice during that window, its balance
// changes while the customer's already-open Stripe session still reflects
// the OLD amount -- and Stripe Checkout Sessions have no live-update
// mechanism once created. This is what this file actually guards against
// -- nothing more speculative than that.
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'

// Called after any backorder-compensation action that can change an
// invoice's balance (lib/backorders.ts's applyBackorder/applyCompensation/
// applyDiscretionaryAccommodation/adjustDiscretionaryAccommodation/
// removeDiscretionaryAccommodation) -- always safe to call for ANY
// invoice, including one with no linked Order at all (the ordinary
// admin-invoice-module case), since it no-ops immediately in that case.
export async function invalidateStaleCheckoutSessionForInvoice(invoiceId: string, reason: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { orderId: true } })
  if (!invoice?.orderId) return // no linked storefront Order -- nothing to invalidate

  const order = await prisma.order.findUnique({ where: { id: invoice.orderId } })
  // Only a still-PENDING order with a live session is actually at risk --
  // an already-PAID/CANCELLED/SHIPPED order's session is either already
  // consumed or already moot.
  if (!order || order.status !== 'PENDING' || !order.stripeSessionId) return

  try {
    await stripe.checkout.sessions.expire(order.stripeSessionId)
  } catch (err) {
    // Already expired/completed on Stripe's side, or a transient API
    // error -- never let a Stripe-side hiccup here block the invoice
    // change that triggered this call; that change already committed.
    console.error('[invalidateStaleCheckoutSessionForInvoice] Stripe session expire failed:', err)
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
  await prisma.$transaction((tx) => releaseAllOrderReservationsTx(tx, order.id, 'system-invoice-change', reason))
}
