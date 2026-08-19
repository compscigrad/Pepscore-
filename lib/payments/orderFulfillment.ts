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
import { getRealStripeFee, resolvePaymentFee } from '@/lib/stripe'
import { createExpenseIdempotent } from '@/lib/finance/expenses'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { buildOrderConfirmationHtml } from '@/emails/OrderConfirmation'
import { achPaymentProcessingSubject, buildAchPaymentProcessingHtml } from '@/emails/AchPaymentProcessing'
import { fulfillAllOrderReservationsTx, releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'
import { finalizeRedemption } from '@/lib/promotions/redemption'
import { trackServerEvent } from '@/lib/analytics/serverTrack'
import { AnalyticsEvent } from '@/lib/analytics/events'
import type { StorefrontPaymentMethodType, Order } from '@prisma/client'

const WEBHOOK_ACTOR_ID = 'system-stripe-webhook'

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
  // Real Stripe balance-transaction data is the source of truth for the
  // actual fee Stripe charged -- never the published-rate estimate, per
  // the standing "don't calculate Stripe fees using an assumed percentage
  // if Stripe exposes the actual fee" rule. Falls back to the estimate
  // (and marks the row stripeFeeIsEstimated: true) only when the real
  // balance transaction genuinely isn't retrievable, never silently.
  const real = await getRealStripeFee(input.paymentIntentId)
  const { fee, net: netAmount, stripeFeeIsEstimated } = resolvePaymentFee(real, input.methodType === 'ACH' ? 'ACH' : 'CARD', input.amountTotal)

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
      stripeFeeIsEstimated,
      provider: 'STRIPE',
      methodType: input.methodType,
      completedAt: new Date(),
    },
    update: { status: 'SUCCEEDED', stripeFee: fee, netAmount, stripeFeeIsEstimated, completedAt: new Date() },
  })

  await prisma.$transaction((tx) => fulfillAllOrderReservationsTx(tx, order.id, 'system-stripe-webhook'))

  // The only point a soft-held promotion code (Phase 4A Critical #1)
  // actually becomes REDEEMED -- payment has now genuinely succeeded.
  // Idempotent (see finalizeRedemption's own comment), so a redelivered
  // webhook that reaches this far again is still safe.
  await finalizeRedemption(order.id)

  // Best-effort funnel event -- amount and payment method are transaction
  // facts, not customer-identifying values, so they're safe to record here.
  void trackServerEvent(AnalyticsEvent.ORDER_PAID, { orderValue: order.total, methodType: input.methodType })

  if (order.invoice) {
    await prisma.invoice.update({ where: { id: order.invoice.id }, data: { status: 'ISSUED', paidAt: new Date() } })
  }

  // Legacy Expense rows -- still what the Admin Overview dashboard's own
  // "2026 Expense Breakdown" card reads (app/admin/page.tsx). Left
  // untouched rather than removed to avoid breaking that existing
  // display; the FinanceExpense write below is the additive fix so the
  // Finance Center's P&L/monthly-summary/exports also see this fee,
  // which they didn't before (they only ever read FinanceExpense, never
  // this legacy model -- a real, separate integration gap this closes).
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

  // FinanceExpense mirror of the Stripe-fee row above -- the Finance
  // Center's P&L/monthlySummary/exports/reconciliation all read
  // FinanceExpense (category PAYMENT_PROCESSING), never the legacy
  // Expense model, so without this the real fee captured above would
  // never actually reach any Finance Center report. Idempotent on
  // input.paymentIntentId: a redelivered webhook for the same payment
  // (Stripe's own retry behavior, or this same event reaching
  // checkout.session.completed and later async_payment_succeeded for one
  // ACH payment) can never double-post the same fee, matching the exact
  // pattern lib/fulfillment/labels.ts already uses for Shippo postage.
  await createExpenseIdempotent(
    {
      date: new Date(),
      vendor: 'Stripe',
      description: `${input.methodType === 'ACH' ? 'ACH' : 'Card'} processing fee for order ${order.orderNumber}${stripeFeeIsEstimated ? ' (estimated -- real balance transaction unavailable at webhook time)' : ''}`,
      amount: fee,
      category: 'PAYMENT_PROCESSING',
      taxTreatment: 'OPERATING_EXPENSE',
      orderId: order.id,
      providerReference: input.paymentIntentId,
      notes: stripeFeeIsEstimated ? 'Estimated via published Stripe rate; real balance_transaction was not retrievable at webhook time.' : `Real Stripe balance transaction fee.`,
    },
    WEBHOOK_ACTOR_ID
  )

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
