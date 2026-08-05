// Pure, DB-free decision logic for the backorder-compensation workflow:
// how a $25 (or any) compensation amount splits across credit / refund /
// account-credit depending on payment state at the moment it's applied, the
// one-per-invoice idempotency decision, and the delivery-status guard that
// blocks shipment progression while a backorder is unresolved.
//
// Design constraints this encodes (locked in with the user before build):
//  - Never fake a refund with an InvoiceDiscount: a discount can only ever
//    reduce a balance that's still actually owed. Money already collected
//    must come back as a real InvoiceRefund; money beyond that has no
//    balance or cash to draw from, so it becomes a CustomerAccountCredit.
//  - Exactly one BackorderCompensation per invoice-delay, ever, without
//    manual admin approval for a second one — decideCompensationDisposition
//    is the single choke point that enforces "link, don't duplicate."
import type { DeliveryStatus, RefundStatus, CompensationDispositionPreference } from '@prisma/client'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface CompensationSplit {
  creditAppliedAmount: number
  refundAmount: number
  accountCreditAmount: number
}

// balanceDue and amountPaid must reflect the invoice's state *before* this
// compensation is applied. Order of disposition: reduce what's still owed
// first (a visible InvoiceDiscount), then dispose of whatever's left
// (money already collected but not owed back through the discount) per the
// admin's chosen preference:
//  - 'REFUND' (default): start a *pending* refund obligation, capped at
//    amountPaid — never more than was actually collected. Any leftover
//    beyond that (compensation bigger than the whole invoice) still falls
//    through to account credit; this is the one case a "combination" of
//    refund + account credit happens under this preference.
//  - 'ACCOUNT_CREDIT': skip the refund entirely — the whole remainder
//    becomes a standing account credit, chosen when the admin doesn't want
//    to promise a manual cash refund at all.
// Creating a refund obligation here is never itself "money returned" — see
// RefundStatus/InvoiceRefund in prisma/schema.prisma.
export function computeCompensationSplit(input: {
  compensationAmount: number
  balanceDue: number
  amountPaid: number
  preference?: CompensationDispositionPreference
}): CompensationSplit {
  const preference = input.preference ?? 'REFUND'
  const creditAppliedAmount = round2(Math.max(0, Math.min(input.compensationAmount, Math.max(0, input.balanceDue))))
  const remainder = round2(input.compensationAmount - creditAppliedAmount)

  if (remainder <= 0) {
    return { creditAppliedAmount, refundAmount: 0, accountCreditAmount: 0 }
  }

  if (preference === 'ACCOUNT_CREDIT') {
    return { creditAppliedAmount, refundAmount: 0, accountCreditAmount: remainder }
  }

  const refundAmount = round2(Math.min(remainder, Math.max(0, input.amountPaid)))
  const accountCreditAmount = round2(remainder - refundAmount)

  return { creditAppliedAmount, refundAmount, accountCreditAmount }
}

export type CompensationDisposition =
  | { kind: 'LINK_EXISTING'; compensationId: string }
  | { kind: 'CREATE_NEW'; split: CompensationSplit }

// The idempotency choke point: if this invoice already has a
// BackorderCompensation on record, a newly-discovered BackorderCondition on
// the same invoice links to it via BackorderConditionCompensation and
// nothing financial happens again. Only the very first backorder on a given
// invoice ever creates money movement — a second $25 is a deliberate,
// separate admin action, never something this function decides on its own.
export function decideCompensationDisposition(input: {
  existingCompensationId: string | null
  compensationAmount: number
  balanceDue: number
  amountPaid: number
  preference?: CompensationDispositionPreference
}): CompensationDisposition {
  if (input.existingCompensationId) {
    return { kind: 'LINK_EXISTING', compensationId: input.existingCompensationId }
  }
  return {
    kind: 'CREATE_NEW',
    split: computeCompensationSplit(input),
  }
}

// Terminal refund states — once reached, a refund can never transition
// again. Shared by completeRefund/failRefund/cancelRefund (lib/backorders.ts)
// so "prevent the same refund from being completed twice" is enforced by
// one pure, tested rule instead of three separate ad-hoc checks.
const TERMINAL_REFUND_STATUSES: RefundStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export function canTransitionRefundStatus(currentStatus: RefundStatus): boolean {
  return !TERMINAL_REFUND_STATUSES.includes(currentStatus)
}

// Shipment progression is blocked past this point while a backorder is
// unresolved — Preparing/Packed remain reachable (that's the customer-facing
// "Preparing" state the backorder hides behind), but nothing that implies
// the package has actually left or arrived is allowed through.
const BLOCKED_DELIVERY_STATUSES: DeliveryStatus[] = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED']

// Mirrors the Fulfillment Gate's own override escape hatch (gate.ts) rather
// than inventing a second one: the same attributed fulfillmentOverrideAt
// that lets an invoice ship before payment also lets it ship past an
// unresolved backorder, so there's exactly one "fulfill anyway" record per
// invoice, not two independent overrides to keep in sync.
export function isDeliveryStatusBlockedByBackorder(input: {
  newDeliveryStatus: DeliveryStatus
  hasActiveBackorder: boolean
  fulfillmentOverrideAt: Date | null
}): boolean {
  if (!BLOCKED_DELIVERY_STATUSES.includes(input.newDeliveryStatus)) return false
  if (input.fulfillmentOverrideAt) return false
  return input.hasActiveBackorder
}

// Same override escape hatch as above, applied to the "add tracking" entry
// point specifically. Unlike the Fulfillment Gate (gate.ts), this never
// checks payment status — an unpaid invoice can still get manual tracking
// entered (COD, in-person arrangements, informal terms are all real cases
// here) — only an unresolved backorder blocks it, since shipping something
// that isn't actually in stock is the one thing this must prevent regardless
// of how payment is being handled.
export function isTrackingBlockedByBackorder(input: {
  hasActiveBackorder: boolean
  fulfillmentOverrideAt: Date | null
}): boolean {
  if (input.fulfillmentOverrideAt) return false
  return input.hasActiveBackorder
}
