// POST /api/webhooks/stripe
// Handles Stripe events — marks orders paid, records payments, sends confirmation email,
// logs expenses for accounting. Must be excluded from Clerk auth middleware.

import { NextRequest, NextResponse } from 'next/server'
import { stripe, estimateStripeFee } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { buildOrderConfirmationHtml } from '@/emails/OrderConfirmation'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { normalizeStripeEvent } from '@/lib/payments/providers/stripe'
import { reconcilePaymentEvent } from '@/lib/payments/reconcile'
import { fulfillAllOrderReservationsTx, releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'

// Required: raw body for Stripe signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Generous limit — Stripe's own webhook-sending infrastructure is shared
  // across many merchants/customers behind a smaller set of IPs, so this
  // exists to cap abuse of the public URL, not to throttle real deliveries.
  const rateLimit = checkRateLimit(`stripe-webhook:${getClientIp(req)}`, 120, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing Stripe signature or webhook secret' }, { status: 400 })
  }

  const rawBody = await req.text()
  let event

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.warn('[webhook] checkout.session.completed missing orderId in metadata')
      return NextResponse.json({ received: true })
    }

    // Idempotency guard: Stripe redelivers an event on any non-2xx response
    // and can occasionally send true duplicates — a retry of this event must
    // be a safe no-op. Without this check, a redelivery hits the unique
    // stripePaymentIntentId constraint on Payment below, throws unhandled,
    // and Stripe retries again — an infinite loop until Stripe gives up.
    const paymentIntentId = session.payment_intent as string
    const existingPayment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
    if (existingPayment) {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    const amountTotal = (session.amount_total ?? 0) / 100
    const stripeFee = estimateStripeFee(amountTotal)
    const netAmount = amountTotal - stripeFee

    // Update order to PAID and save payment intent ID
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        stripePaymentIntentId: session.payment_intent as string,
        stripeFee,
      },
      include: { items: true, invoice: true },
    })

    // Create Payment record -- providerTransactionId mirrors
    // stripePaymentIntentId (same value) so reconcilePaymentEvent's later
    // refund/dispute/cancellation lookups can match on either field, and a
    // future non-Stripe provider has a real generic column to write to
    // instead of one named for this specific processor.
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentIntentId: session.payment_intent as string,
        amount: amountTotal,
        status: 'SUCCEEDED',
        stripeFee,
        netAmount,
        provider: 'STRIPE',
        methodType: 'CARD',
        providerTransactionId: session.payment_intent as string,
        completedAt: new Date(),
      },
    })

    // Deduct the physical stock this order's checkout already reserved
    // (app/api/checkout/route.ts) -- a card payment settles synchronously,
    // so fulfillment happens right here rather than waiting on a second
    // webhook event the way ACH's async_payment_succeeded does below.
    await prisma.$transaction((tx) => fulfillAllOrderReservationsTx(tx, order.id, 'system-stripe-webhook'))

    // Mark invoice as ISSUED
    if (order.invoice) {
      await prisma.invoice.update({
        where: { id: order.invoice.id },
        data: { status: 'ISSUED', paidAt: new Date() },
      })
    }

    // Log expenses for accounting
    await prisma.expense.createMany({
      data: [
        {
          type: 'STRIPE_FEE',
          amount: stripeFee,
          description: `Stripe fee for order ${order.orderNumber}`,
          orderId: order.id,
        },
        {
          type: 'COGS',
          amount: order.items.reduce((s, i) => s + i.costOfGoods, 0),
          description: `COGS for order ${order.orderNumber}`,
          orderId: order.id,
        },
      ],
    })

    // Send order confirmation email
    try {
      const html = buildOrderConfirmationHtml({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        items: order.items.map(i => ({
          name: i.name,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        total: order.total,
        invoiceNumber: order.invoice?.invoiceNumber ?? '',
      })

      await sendCategorizedEmail(
        { category: 'ORDER_CONFIRMATION', to: order.customerEmail, subject: `Order Confirmed — ${order.orderNumber} | Pepscore`, html },
        { invoiceId: order.invoice?.id ?? null, actorType: 'SYSTEM' }
      )
    } catch (emailErr) {
      // Log but don't fail — order is already recorded
      console.error('[webhook] Failed to send confirmation email:', emailErr)
    }
  }

  // ── payment_intent.payment_failed ──────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    // Find order by payment intent and mark failed
    try {
      const failedOrder = await prisma.order.findFirst({ where: { stripePaymentIntentId: pi.id } })
      if (failedOrder) {
        await prisma.order.update({ where: { id: failedOrder.id }, data: { status: 'CANCELLED' } })
        // Release the stock this order's checkout reserved -- a failed
        // payment must never keep holding units another customer could buy.
        await prisma.$transaction((tx) => releaseAllOrderReservationsTx(tx, failedOrder.id, 'system-stripe-webhook', 'Payment failed'))
      }
    } catch {
      // Order may not exist yet — ignore
    }
  }

  // ── refund / dispute / cancellation reconciliation ──────────────────────
  // These three event types previously had no handler at all -- a refund
  // or a dispute issued from the Stripe dashboard left the Payment row
  // permanently showing SUCCEEDED with no record anything had changed.
  // Uses the same normalization the provider abstraction is built on
  // (lib/payments/providers/stripe.ts) rather than parsing the event
  // inline, so a future non-Stripe provider's webhook can reconcile
  // through the identical reconcilePaymentEvent() path.
  if (
    event.type === 'charge.refunded' ||
    event.type === 'charge.dispute.created' ||
    event.type === 'payment_intent.canceled'
  ) {
    const normalized = normalizeStripeEvent(event)
    if (normalized) {
      await reconcilePaymentEvent(normalized)
    }
  }

  return NextResponse.json({ received: true })
}
