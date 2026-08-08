// Applies a NormalizedPaymentEvent to the existing Payment/Order rows.
// Deliberately scoped to reconciling STATE CHANGES on a payment that
// already exists (refund, partial refund, dispute, cancellation) --
// initial Payment-row creation stays in
// app/api/webhooks/stripe/route.ts's checkout.session.completed handler,
// since that does more than a status update (creates the row for the
// first time, issues the invoice, logs expenses, sends the confirmation
// email) and isn't something a generic reconciler should own.
//
// Order-level state is only ever moved for the two events that already
// have a matching OrderStatus value (REFUNDED, CANCELLED). A partial
// refund or a dispute updates the Payment row's own status/refundedAmount/
// disputedAt but deliberately leaves Order.status at PAID -- whether a
// dispute should freeze fulfillment is a real business decision outside
// this PR's scope (see docs/Decisions.md), not something to silently
// decide inside a reconciliation helper.
import { prisma } from '@/lib/prisma'
import type { NormalizedPaymentEvent } from './types'

export interface ReconcileResult {
  matched: boolean
  paymentId?: string
}

export async function reconcilePaymentEvent(event: NormalizedPaymentEvent): Promise<ReconcileResult> {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [{ stripePaymentIntentId: event.providerTransactionId }, { providerTransactionId: event.providerTransactionId }],
    },
  })
  if (!payment) return { matched: false }

  switch (event.status) {
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED': {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: event.status, refundedAmount: event.refundedAmount ?? payment.refundedAmount },
      })
      if (event.status === 'REFUNDED') {
        await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED' } })
      }
      break
    }

    case 'DISPUTED': {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'DISPUTED', disputedAt: event.occurredAt } })
      break
    }

    case 'CANCELLED': {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } })
      await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'CANCELLED' } })
      break
    }

    default:
      // Other statuses (PENDING/PROCESSING/AUTHORIZED/SUCCEEDED/FAILED/
      // RETURNED) aren't reached through this reconciler yet -- SUCCEEDED
      // is still handled by checkout.session.completed's own bespoke
      // creation path, and FAILED by payment_intent.payment_failed's
      // existing Order-only update. Nothing to do here for them today.
      break
  }

  return { matched: true, paymentId: payment.id }
}
