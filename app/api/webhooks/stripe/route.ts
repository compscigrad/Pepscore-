// POST /api/webhooks/stripe
// Handles Stripe events — marks orders paid, records payments, sends confirmation email,
// logs expenses for accounting. Must be excluded from Clerk auth middleware.

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { normalizeStripeEvent } from '@/lib/payments/providers/stripe'
import { reconcilePaymentEvent } from '@/lib/payments/reconcile'
import { markOrderPaid, markOrderPaymentProcessing, markOrderPaymentFailedOrReturned } from '@/lib/payments/orderFulfillment'
import type Stripe from 'stripe'

// Required: raw body for Stripe signature verification
export const runtime = 'nodejs'

// Best-effort lookup of the safe-to-display bank details + mandate
// reference for an ACH PaymentIntent -- none of this is on the Checkout
// Session event payload itself, only reachable via the expanded
// PaymentIntent/PaymentMethod. Never throws: a failure here means the
// payment still gets recorded as PROCESSING, just without bank/mandate
// detail filled in yet (a later event or manual lookup can backfill it;
// it never blocks the payment lifecycle itself).
async function fetchAchDetails(paymentIntentId: string) {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['payment_method'] })
    const pm = pi.payment_method
    if (!pm || typeof pm === 'string' || !pm.us_bank_account) return {}
    const mandateOptions = pi.payment_method_options?.us_bank_account as { mandate_options?: { id?: string } } | undefined
    return {
      bankName: pm.us_bank_account.bank_name ?? null,
      bankAccountLast4: pm.us_bank_account.last4 ?? null,
      bankAccountType: pm.us_bank_account.account_type ?? null,
      stripePaymentMethodId: pm.id,
      mandateId: mandateOptions?.mandate_options?.id ?? null,
    }
  } catch (err) {
    console.error('[webhook] Failed to retrieve ACH PaymentIntent details:', err)
    return {}
  }
}

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
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── checkout.session.completed ──────────────────────────────────────────────
  // Fires once the customer finishes Stripe's hosted Checkout page --
  // for a synchronous method (card) this means paid; for an async method
  // (ACH) it only means the debit was SUBMITTED, not that it cleared.
  // session.payment_status is the authoritative signal for which case
  // this is (Stripe's own recommended pattern for async payment methods).
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.warn('[webhook] checkout.session.completed missing orderId in metadata')
      return NextResponse.json({ received: true })
    }

    const paymentIntentId = session.payment_intent as string
    const amountTotal = (session.amount_total ?? 0) / 100
    const existingPayment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })

    if (session.payment_status === 'paid') {
      // Idempotency guard: Stripe redelivers an event on any non-2xx
      // response and can occasionally send true duplicates.
      if (existingPayment?.status === 'SUCCEEDED') {
        return NextResponse.json({ received: true, alreadyProcessed: true })
      }
      await markOrderPaid({ orderId, paymentIntentId, amountTotal, methodType: 'CARD' })
    } else {
      // Async method (ACH) still processing -- never mark paid here.
      if (existingPayment) {
        return NextResponse.json({ received: true, alreadyProcessed: true })
      }
      const achDetails = await fetchAchDetails(paymentIntentId)
      await markOrderPaymentProcessing({ orderId, paymentIntentId, amountTotal, ...achDetails })
    }
  }

  // ── checkout.session.async_payment_succeeded ────────────────────────────
  // The authoritative "ACH debit actually cleared" signal -- can arrive
  // days after checkout.session.completed. Routes through the exact same
  // markOrderPaid() the synchronous card path uses.
  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.warn('[webhook] checkout.session.async_payment_succeeded missing orderId in metadata')
      return NextResponse.json({ received: true })
    }
    const paymentIntentId = session.payment_intent as string
    const existingPayment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
    if (existingPayment?.status === 'SUCCEEDED') {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }
    const amountTotal = (session.amount_total ?? 0) / 100
    await markOrderPaid({ orderId, paymentIntentId, amountTotal, methodType: 'ACH' })
  }

  // ── checkout.session.async_payment_failed ───────────────────────────────
  // The ACH debit was rejected (insufficient funds, invalid account,
  // revoked authorization, etc.) -- releases the reservation this order's
  // checkout was holding.
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.warn('[webhook] checkout.session.async_payment_failed missing orderId in metadata')
      return NextResponse.json({ received: true })
    }
    const existingPayment = await prisma.payment.findFirst({ where: { orderId, status: { in: ['FAILED', 'RETURNED'] } } })
    if (existingPayment) {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }
    await markOrderPaymentFailedOrReturned({ orderId, status: 'FAILED', reason: 'ACH payment failed' })
  }

  // ── checkout.session.expired ─────────────────────────────────────────────
  // Fires when an embedded Checkout session's own TTL (Stripe's default:
  // 24h from creation) elapses with no completed payment -- Phase 4A
  // Critical #3. Without this, an order the customer opened checkout for
  // and then abandoned stayed PENDING with its OrderReservation ACTIVE
  // forever, permanently holding real inventory no one would ever pay for.
  // Reuses the exact same release path an explicit payment failure already
  // goes through. Only acts if the order is still genuinely PENDING --
  // Stripe doesn't guarantee event delivery order, so if a
  // checkout.session.completed for this same session was somehow processed
  // first (or arrives after, redelivered), this never overwrites a real
  // payment. A scheduled reconciliation job (app/api/cron/release-
  // abandoned-reservations) is the backstop for the case this webhook
  // itself never arrives.
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.warn('[webhook] checkout.session.expired missing orderId in metadata')
      return NextResponse.json({ received: true })
    }
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } })
    if (order?.status === 'PENDING') {
      await markOrderPaymentFailedOrReturned({
        orderId,
        status: 'CANCELLED',
        reason: 'Checkout session expired -- payment was never completed',
      })
    }
  }

  // ── payment_intent.payment_failed ──────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    try {
      const failedOrder = await prisma.order.findFirst({ where: { stripePaymentIntentId: pi.id } })
      if (failedOrder) {
        await markOrderPaymentFailedOrReturned({ orderId: failedOrder.id, status: 'FAILED', reason: 'Payment failed' })
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
