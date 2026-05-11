// POST /api/webhooks/stripe
// Handles Stripe events — marks orders paid, records payments, sends confirmation email,
// logs expenses for accounting. Must be excluded from Clerk auth middleware.

import { NextRequest, NextResponse } from 'next/server'
import { stripe, estimateStripeFee } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { buildOrderConfirmationHtml } from '@/emails/OrderConfirmation'

// Required: raw body for Stripe signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
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

    // Create Payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentIntentId: session.payment_intent as string,
        amount: amountTotal,
        status: 'SUCCEEDED',
        stripeFee,
        netAmount,
      },
    })

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

      await resend.emails.send({
        from: FROM_EMAIL,
        to: order.customerEmail,
        subject: `Order Confirmed — ${order.orderNumber} | Pepscore`,
        html,
      })
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
      await prisma.order.updateMany({
        where: { stripePaymentIntentId: pi.id },
        data: { status: 'CANCELLED' },
      })
    } catch {
      // Order may not exist yet — ignore
    }
  }

  return NextResponse.json({ received: true })
}
