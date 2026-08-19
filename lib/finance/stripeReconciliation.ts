// Stripe Reconciliation (2026-08-18 Finance Center sprint). Reads the
// existing Payment model's own Stripe-sourced fields (stripeFee,
// netAmount, payoutId, settledAt, refundedAmount) -- no new schema, no
// direct Stripe API dependence, matching the spec's explicit "don't
// create API dependence where the existing webhook/database record is
// already sufficient" instruction. Storefront checkout (Order/Payment) is
// the only model with real per-transaction Stripe linkage -- InvoicePayment
// (the actual current sales channel) records "STRIPE" only as a payment
// *method* label, not a reconciled processor transaction, so this
// necessarily returns no rows until real storefront orders exist. That's
// accurate today, not a bug.
import { prisma } from '@/lib/prisma'
import type { DateRange } from './reports'

export type ReconciliationStatus = 'MATCHED' | 'PARTIAL' | 'MISMATCH' | 'PENDING' | 'NOT_AVAILABLE'

export interface StripeReconciliationRow {
  orderId: string
  orderNumber: string
  orderTotal: number
  stripePaymentIntentId: string
  stripeGross: number
  stripeFees: number
  stripeFeeIsEstimated: boolean
  refundedAmount: number
  netSettlement: number
  payoutId: string | null
  settledAt: Date | null
  status: ReconciliationStatus
}

// Pure -- exported for unit testing. A cent of float-rounding slack is
// tolerated (matches this codebase's existing Float money representation)
// before something counts as a real mismatch.
export function deriveReconciliationStatus(orderTotal: number, paymentAmount: number, paymentStatus: string, settledAt: Date | null): ReconciliationStatus {
  const TOLERANCE = 0.01
  if (paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING' || paymentStatus === 'AUTHORIZED') return 'PENDING'
  if (paymentStatus === 'FAILED') return 'NOT_AVAILABLE'
  const diff = Math.abs(orderTotal - paymentAmount)
  if (diff > TOLERANCE) return 'MISMATCH'
  if (paymentStatus === 'PARTIALLY_REFUNDED') return 'PARTIAL'
  if (!settledAt) return 'PENDING'
  return 'MATCHED'
}

// Pure -- exported for unit testing. 2026-08-19 Stripe fee-reconciliation
// hardening: a real, found-and-fixed defect. `Payment.netAmount` is set
// once, at charge time, from either Stripe's real balance transaction
// (amount - fee) or the published-rate fallback -- it has no way to know
// about a refund that happens later, since refunds are recorded
// separately via reconcilePaymentEvent(). The previous inline expression
// (`p.netAmount || p.amount - p.stripeFee - p.refundedAmount`) used
// netAmount as-is whenever it was truthy, which is true for every real
// payment markOrderPaid() ever creates -- meaning the refund-aware
// fallback branch was structurally dead code, and a refund on any
// payment never actually reduced its displayed Net Settlement. Fixed by
// always subtracting refundedAmount from whichever gross-minus-fee figure
// is available, never trusting a stored net-at-charge-time value alone
// once a refund exists.
export function computeNetSettlement(amount: number, fee: number, netAmount: number, refundedAmount: number): number {
  const grossLessFee = netAmount || amount - fee
  return grossLessFee - refundedAmount
}

export async function getStripeReconciliationReport(range: DateRange): Promise<StripeReconciliationRow[]> {
  const payments = await prisma.payment.findMany({
    where: { provider: 'STRIPE', createdAt: { gte: range.from, lte: range.to }, order: { isTestData: false } },
    include: { order: { select: { id: true, orderNumber: true, total: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return payments.map((p) => ({
    orderId: p.order.id,
    orderNumber: p.order.orderNumber,
    orderTotal: p.order.total,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeGross: p.amount,
    stripeFees: p.stripeFee,
    stripeFeeIsEstimated: p.stripeFeeIsEstimated,
    refundedAmount: p.refundedAmount,
    netSettlement: computeNetSettlement(p.amount, p.stripeFee, p.netAmount, p.refundedAmount),
    payoutId: p.payoutId,
    settledAt: p.settledAt,
    status: deriveReconciliationStatus(p.order.total, p.amount, p.status, p.settledAt),
  }))
}

export interface StripeReconciliationSummary {
  range: DateRange
  totalRows: number
  matched: number
  partial: number
  mismatch: number
  pending: number
  notAvailable: number
  totalStripeGross: number
  totalStripeFees: number
  totalNetSettlement: number
}

export async function getStripeReconciliationSummary(range: DateRange): Promise<StripeReconciliationSummary> {
  const rows = await getStripeReconciliationReport(range)
  const count = (s: ReconciliationStatus) => rows.filter((r) => r.status === s).length
  return {
    range,
    totalRows: rows.length,
    matched: count('MATCHED'),
    partial: count('PARTIAL'),
    mismatch: count('MISMATCH'),
    pending: count('PENDING'),
    notAvailable: count('NOT_AVAILABLE'),
    totalStripeGross: rows.reduce((s, r) => s + r.stripeGross, 0),
    totalStripeFees: rows.reduce((s, r) => s + r.stripeFees, 0),
    totalNetSettlement: rows.reduce((s, r) => s + r.netSettlement, 0),
  }
}
