// Shared "what happens when a storefront Order's payment resolves" logic,
// used by app/api/webhooks/stripe/route.ts's card path (synchronous,
// checkout.session.completed with payment_status 'paid') AND its ACH path
// (asynchronous -- checkout.session.completed only starts the ACH debit;
// checkout.session.async_payment_succeeded/failed carry the real outcome,
// which can arrive days later). Both payment methods funnel through the
// SAME markOrderPaid()/markOrderPaymentFailedOrReturned() so "what a paid
// or failed order actually does" is defined in exactly one place rather
// than duplicated per payment method.
import { prisma } from '@/lib/prisma'
import { estimateStripeFee, estimateAchFee } from '@/lib/stripe'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { buildOrderConfirmationHtml } from '@/emails/OrderConfirmation'
import { achPaymentProcessingSubject, buildAchPaymentProcessingHtml } from '@/emails/AchPaymentProcessing'
import { fulfillAllOrderReservationsTx, releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'
import { finalizeRedemption } from '@/lib/promotions/redemption'
import type { StorefrontPaymentMethodType, Order } from '@prisma/client'

export interface MarkOrderPaidInput {
  orderId: string
  paymentIntentId: string
  amountTotal: number
  methodType: StorefrontPaymentMethodType
}

// Idempotent via Payment.upsert keyed on stripePaymentIntentId -- a card
// payment has no pre-existing row (create branch); an ACH payment already
// has a PROCESSING row from markOrderPaymentProcessing below (update
// branch). Callers are still responsible for skipping entirely when the
// existing row already shows SUCCEEDED (a genuine Stripe webhook
// redelivery), since re-running this would re-fulfill/re-email otherwise-
// idempotent steps unnecessarily -- fulfillAllOrderReservationsTx and the
// expense/email steps don't themselves re-check that.
export async function markOrderPaid(input: MarkOrderPaidInput): Promise<Order> {
  const fee = input.methodType === 'ACH' ? estimateAchFee(input.amountTotal) : estimateStripeFee(input.amountTotal)
  const netAmount = input.amountTotal - fee

  const order = await prisma.order.update({
    where: { id: input.orderId },
    data: { status: 'PAID', stripePaymentIntentId: input.paymentIntentId, stripeFee: fee },
    include: { items: true, invoice: true },
  })

  await prisma.payment.upsert({
    where: { stripePaymentIntentId: input.paymentIntentId },
    create: {
      orderId: order.id,
      stripePaymentIntentId: input.paymentIntentId,
      providerTransactionId: input.paymentIntentId,
      amount: input.amountTotal,
      status: 'SUCCEEDED',
      stripeFee: fee,
      netAmount,
      provider: 'STRIPE',
      methodType: input.methodType,
      completedAt: new Date(),
    },
    update: { status: 'SUCCEEDED', stripeFee: fee, netAmount, completedAt: new Date() },
  })

  await prisma.$transaction((tx) => fulfillAllOrderReservationsTx(tx, order.id, 'system-stripe-webhook'))

  // The only point a soft-held promotion code (Phase 4A Critical #1)
  // actually becomes REDEEMED -- payment has now genuinely succeeded.
  // Idempotent (see finalizeRedemption's own comment), so a redelivered
  // webhook that reaches this far again is still safe.
  await finalizeRedemption(order.id)

  if (order.invoice) {
    await prisma.invoice.update({ where: { id: order.invoice.id }, data: { status: 'ISSUED', paidAt: new Date() } })
  }

  await prisma.expense.createMany({
    data: [
      {
        type: 'STRIPE_FEE',
        amount: fee,
        description: `${input.methodType === 'ACH' ? 'ACH' : 'Stripe'} fee for order ${order.orderNumber}`,
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

  try {
    const html = buildOrderConfirmationHtml({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: order.items.map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, unitPrice: i.unitPrice })),
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
    // Log but don't fail -- order is already recorded as paid.
    console.error('[markOrderPaid] Failed to send confirmation email:', emailErr)
  }

  return order
}

export interface MarkOrderPaymentProcessingInput {
  orderId: string
  paymentIntentId: string
  amountTotal: number
  bankName?: string | null
  bankAccountLast4?: string | null
  bankAccountType?: string | null
  stripePaymentMethodId?: string | null
  mandateId?: string | null
}

// ACH-specific: checkout.session.completed fires once the customer submits
// their bank details, but the debit itself hasn't cleared yet -- this
// records that a payment attempt exists (status PROCESSING, never PAID)
// and captures the mandate/bank-display evidence, without touching Order
// status, reservations, invoice status, expenses, or sending the "paid"
// confirmation. markOrderPaid() above is what actually marks it paid, once
// checkout.session.async_payment_succeeded confirms the debit cleared.
export async function markOrderPaymentProcessing(input: MarkOrderPaymentProcessingInput) {
  const payment = await prisma.payment.upsert({
    where: { stripePaymentIntentId: input.paymentIntentId },
    create: {
      orderId: input.orderId,
      stripePaymentIntentId: input.paymentIntentId,
      providerTransactionId: input.paymentIntentId,
      amount: input.amountTotal,
      status: 'PROCESSING',
      provider: 'STRIPE',
      methodType: 'ACH',
      bankName: input.bankName ?? undefined,
      bankAccountLast4: input.bankAccountLast4 ?? undefined,
      bankAccountType: input.bankAccountType ?? undefined,
    },
    update: {}, // a redelivery of this same event is a no-op -- already recorded
  })

  if (input.mandateId || input.stripePaymentMethodId) {
    await prisma.achAuthorization.upsert({
      where: { paymentId: payment.id },
      create: {
        orderId: input.orderId,
        paymentId: payment.id,
        stripePaymentMethodId: input.stripePaymentMethodId ?? undefined,
        mandateId: input.mandateId ?? undefined,
      },
      update: {},
    })
  }

  const order = await prisma.order.findUnique({ where: { id: input.orderId } })
  if (order) {
    try {
      const html = buildAchPaymentProcessingHtml({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        total: order.total,
        bankName: input.bankName,
        bankAccountLast4: input.bankAccountLast4,
      })
      await sendCategorizedEmail(
        { category: 'ACH_PAYMENT_PROCESSING', to: order.customerEmail, subject: achPaymentProcessingSubject(order.orderNumber), html },
        { actorType: 'SYSTEM' }
      )
    } catch (emailErr) {
      console.error('[markOrderPaymentProcessing] Failed to send processing email:', emailErr)
    }
  }

  return payment
}

export interface MarkOrderPaymentFailedInput {
  orderId: string
  // CANCELLED covers an abandoned/expired checkout session (Phase 4A
  // Critical #3) -- no payment attempt was ever actually declined, so
  // FAILED would misrepresent what happened; CANCELLED matches the real
  // Prisma PaymentStatus value for "never completed."
  status: 'FAILED' | 'RETURNED' | 'CANCELLED'
  reason?: string
}

// Covers both a card decline (FAILED, existing payment_intent.payment_failed
// path) and an ACH failure/return (checkout.session.async_payment_failed --
// RETURNED is reserved for a future inbound-return-specific event, not
// distinguished from FAILED by Stripe's async_payment_failed itself).
// Always releases whatever this order's checkout reserved -- a failed
// payment must never keep holding stock another customer could buy.
export async function markOrderPaymentFailedOrReturned(input: MarkOrderPaymentFailedInput): Promise<void> {
  await prisma.order.update({ where: { id: input.orderId }, data: { status: 'CANCELLED' } })
  await prisma.payment.updateMany({
    where: { orderId: input.orderId, status: { in: ['PENDING', 'PROCESSING', 'AUTHORIZED'] } },
    data: { status: input.status },
  })
  await prisma.$transaction((tx) => releaseAllOrderReservationsTx(tx, input.orderId, 'system-stripe-webhook', input.reason ?? 'Payment failed'))
}
