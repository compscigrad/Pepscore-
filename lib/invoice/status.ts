// Single source of truth for deriving InvoicePaymentStatus and the
// "positive balance keeps an issued invoice Pending" workflow-status rule
// (docs/Decisions.md — the payment-status overhaul). Pure and DB-free, same
// pattern as lib/tracking/orderStatus.ts's computeOrderStatus, so both
// lib/invoices.ts (payment side) and any other caller recompute identically
// instead of re-deriving this logic inline.
import type { InvoiceStatus, InvoicePaymentStatus, PaymentIntentStatus } from '@prisma/client'

export interface DerivedPaymentAmounts {
  paymentStatus: InvoicePaymentStatus
  balanceDue: number
  overpaidAmount: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Confirmed payments only — never call this with a proposed/selected amount
// that hasn't actually been recorded as a confirmed InvoicePayment.
export function deriveInvoicePaymentAmounts(amountPaid: number, total: number): DerivedPaymentAmounts {
  const balanceDue = Math.max(round2(total - amountPaid), 0)
  const overpaidAmount = Math.max(round2(amountPaid - total), 0)

  const paymentStatus: InvoicePaymentStatus =
    amountPaid <= 0 ? 'UNPAID' : amountPaid >= total ? 'PAID' : 'PARTIALLY_PAID'

  return { paymentStatus, balanceDue, overpaidAmount }
}

// Terminal workflow states an admin sets deliberately — the positive-balance
// rule never overrides these, and issuance validation never applies to them.
const TERMINAL_STATUSES: InvoiceStatus[] = ['CANCELLED', 'REFUNDED', 'VOID']

// The Mandatory Positive-Balance Invoice Status Rule: once an invoice has
// been issued at least once, its workflow status is *never* set directly by
// an admin dropdown or a client action — it's purely a function of whether a
// balance remains. Balance Due > $0 always means Pending, regardless of why
// (unpaid, partially paid, pay-in-full selected, arrangement requested,
// arrangement approved or denied, installments partially paid). Balance Due
// reaching $0 returns the invoice to Issued — never further, since
// "Completed" is a separate, pre-existing dimension (InvoiceOrderStatus,
// computeOrderStatus) requiring delivery too, not just payment.
export function deriveInvoiceWorkflowStatus(input: {
  currentStatus: InvoiceStatus
  hasBeenIssued: boolean
  balanceDue: number
}): InvoiceStatus {
  if (TERMINAL_STATUSES.includes(input.currentStatus)) return input.currentStatus
  if (!input.hasBeenIssued) return 'DRAFT'
  return input.balanceDue > 0 ? 'PENDING' : 'ISSUED'
}

// The Payment Intent Status set at the *moment* an invoice first becomes
// Issued (docs/Decisions.md's issuance branching A/B/C) — never called again
// on a later re-save, since a client selection or arrangement already in
// progress must never be silently reset back to "awaiting selection."
export function deriveInitialPaymentIntentStatus(balanceDue: number): PaymentIntentStatus {
  return balanceDue > 0 ? 'AWAITING_CLIENT_SELECTION' : 'NOT_AVAILABLE'
}

// After a confirmed payment brings the balance to $0, resolve whatever
// client-facing intent was in flight to its natural resting state. A
// selection/arrangement that was actually awaiting confirmation is now
// Confirmed; an invoice that reached $0 without any client action in
// progress (e.g. an admin recording a phone-verified payment directly) has
// nothing to confirm, so it's simply Not Available again.
const IN_PROGRESS_INTENTS: PaymentIntentStatus[] = [
  'AWAITING_MANUAL_CONFIRMATION',
  'ARRANGEMENT_APPROVAL_PENDING',
  'ARRANGEMENT_APPROVED',
  'ARRANGEMENT_DENIED',
]

export function resolvePaymentIntentAfterPayment(
  current: PaymentIntentStatus,
  balanceDue: number
): PaymentIntentStatus {
  if (balanceDue > 0) return current
  return IN_PROGRESS_INTENTS.includes(current) ? 'CONFIRMED' : current === 'AWAITING_CLIENT_SELECTION' ? 'NOT_AVAILABLE' : current
}

// Section 14's installment-count recommendation: prefer the fewest
// reasonable payments, capped at 3 for a balance of $1,000 or less, and up
// to 4 above that. The admin may still override this before approval
// (lib/paymentArrangements.ts's approve/create paths accept an explicit
// count) — this is only ever a *recommendation*.
export function recommendInstallmentCount(balanceToSchedule: number): number {
  if (balanceToSchedule <= 0) return 0
  return balanceToSchedule <= 1000 ? 3 : 4
}
