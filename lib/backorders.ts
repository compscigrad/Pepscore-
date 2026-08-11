// Data access for the backorder + compensation workflow. Mirrors
// lib/paymentArrangements.ts's separation from lib/invoices.ts: this module
// owns backorder/compensation/refund rows and only ever *adds* to an
// invoice's financial totals (via recalculateInvoiceFinancials, the same
// math lib/invoices.ts's updateInvoice already uses) rather than duplicating
// the authoritative total/balanceDue calculation.
//
// Refund safety: Pepscore has no integrated online-payment/auto-refund
// provider, so an InvoiceRefund this module creates is never itself "money
// returned" — it starts PENDING and only becomes COMPLETED when an admin
// explicitly calls completeRefund() after actually moving the money (or,
// eventually, when a real payment-provider webhook confirms it through the
// same record). Nothing in this file tells a customer a refund is done
// until that has genuinely happened.
import {
  Prisma,
  type DeliveryStatus,
  type CompensationDispositionPreference,
  type InvoiceRefund,
  type BackorderCompensation,
  type BackorderCompensationType,
  type TrackingEventSource,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceLineItemInput, type InvoiceDiscountInput } from '@/lib/invoice/calculations'
import { deriveInvoicePaymentAmounts, deriveInvoiceWorkflowStatus } from '@/lib/invoice/status'
import { computeOrderStatus } from '@/lib/tracking/orderStatus'
import {
  decideCompensationDisposition,
  computeCompensationSplit,
  isDeliveryStatusBlockedByBackorder,
  canTransitionRefundStatus,
  isAutomaticCompensationEligible,
  BACKORDER_AUTOMATIC_MINIMUM_ORDER_TOTAL,
  type CompensationSplit,
} from '@/lib/invoice/backorder'
import { syncCustomerFromInvoiceEvent, recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import {
  backorderNoticeSubject,
  buildBackorderNoticeHtml,
  backorderResolvedSubject,
  buildBackorderResolvedHtml,
  refundCompletedSubject,
  buildRefundCompletedHtml,
  backorderAccommodationSubject,
  buildBackorderAccommodationHtml,
} from '@/emails/BackorderNotice'
import { backorderFinancialActionRequiredSubject, buildBackorderFinancialActionRequiredHtml } from '@/emails/AdminBackorderAlerts'
import { invalidateStaleCheckoutSessionForInvoice } from '@/lib/payments/staleSessionGuard'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export const BACKORDER_COMPENSATION_AMOUNT = 25
export const BACKORDER_COMPENSATION_LABEL = 'Backorder Service Credit'
// The admin-discretionary counterpart -- a distinct customer-facing label
// (never "Backorder Service Credit") so a customer's invoice/portal line
// item and the admin UI both read unambiguously as a manual, real-time
// customer-service adjustment rather than the standard automatic policy.
export const BACKORDER_ACCOMMODATION_LABEL = 'Backorder Accommodation'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Thrown by assertDeliveryStatusAllowed — a business-rule failure, not a
// server error, same shape/intent as lib/invoices.ts's InvoiceIssuanceError
// (callers render a clean 4xx instead of a generic 500).
export class BackorderBlockedError extends Error {}

// Mirrors lib/notifications/paymentWorkflow.ts's own private helper of the
// same name/shape — kept as a small local duplicate rather than a shared
// import, consistent with how round2()/formatMoney() are duplicated per
// file elsewhere in this codebase.
async function logInvoiceAndCustomerEvent(
  invoice: { id: string; customerId: string | null },
  eventType: string,
  newValue?: string | null,
  userId?: string
): Promise<void> {
  await prisma.invoiceActivityLog.create({
    data: { invoiceId: invoice.id, eventType, newValue: newValue ?? undefined, source: 'MANUAL', userId: userId ?? undefined },
  })
  if (invoice.customerId) {
    await recordCustomerActivity({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType,
      newValue,
      source: 'MANUAL',
      userId: userId ?? undefined,
    })
  }
}

async function recalculateInvoiceFinancials(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, discounts: true },
  })
  const totals = calculateInvoiceTotals(
    invoice.items as InvoiceLineItemInput[],
    invoice.discounts as InvoiceDiscountInput[],
    invoice.shippingCost,
    invoice.amountPaid
  )
  const paymentAmounts = deriveInvoicePaymentAmounts(invoice.amountPaid, totals.total)
  const newStatus = deriveInvoiceWorkflowStatus({
    currentStatus: invoice.status,
    hasBeenIssued: invoice.status !== 'DRAFT',
    balanceDue: paymentAmounts.balanceDue,
  })

  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      balanceDue: paymentAmounts.balanceDue,
      overpaidAmount: paymentAmounts.overpaidAmount,
      paymentStatus: paymentAmounts.paymentStatus,
      status: newStatus,
      orderStatus: computeOrderStatus(newStatus, paymentAmounts.paymentStatus, invoice.shippingStatus, invoice.orderStatus),
    },
  })
}

export async function hasActiveBackorder(invoiceId: string): Promise<boolean> {
  const count = await prisma.backorderCondition.count({ where: { invoiceId, status: 'ACTIVE' } })
  return count > 0
}

// The save-time guard lib/invoices.ts's updateInvoice calls before writing
// deliveryStatus — never trusts the UI to have disabled the right options,
// same "never trust the client" posture as everything else in this codebase.
export async function assertDeliveryStatusAllowed(input: {
  invoiceId: string
  newDeliveryStatus: DeliveryStatus
  fulfillmentOverrideAt: Date | null
}): Promise<void> {
  const blocked = isDeliveryStatusBlockedByBackorder({
    newDeliveryStatus: input.newDeliveryStatus,
    hasActiveBackorder: await hasActiveBackorder(input.invoiceId),
    fulfillmentOverrideAt: input.fulfillmentOverrideAt,
  })
  if (blocked) {
    throw new BackorderBlockedError(
      'This invoice has an active backorder — resolve it (or record a fulfillment override) before marking it shipped, in transit, or delivered.'
    )
  }
}

interface ApplyCompensationTxResult {
  // Null exactly when this was an AUTOMATIC request, no compensation
  // exists yet for this invoice, and the invoice's pre-compensation total
  // does not exceed the $100 minimum — the BackorderCondition itself is
  // still created either way (see applyBackorder); only the financial
  // compensation is gated.
  compensation: BackorderCompensation | null
  isNew: boolean
  skippedReason: 'BELOW_MINIMUM_ORDER_TOTAL' | null
  // Only set when a brand-new PENDING refund obligation was just created in
  // this call — never set on a LINK_EXISTING reuse, so callers know exactly
  // when (and only when) the "manual refund required" admin alert applies.
  newRefund: InvoiceRefund | null
}

interface ApplyCompensationInput {
  amount?: number
  reason?: string
  appliedBy: string
  preference?: CompensationDispositionPreference
  compensationType?: BackorderCompensationType
}

// The single choke point for the flat backorder compensation: idempotent
// per invoice *per type* (decideCompensationDisposition, scoped by
// compensationType below), and disposes the amount as
// credit/refund-obligation/account-credit strictly by the invoice's payment
// state and the admin's chosen preference at this exact moment
// (lib/invoice/backorder.ts's split algorithm) — never a fabricated
// completed refund against an InvoiceDiscount, never a silently dropped
// credit, and never an auto-completed cash refund with no provider behind
// it. Safe to call once per newly-discovered backorder on an invoice; every
// call after the first on the same invoice is a no-op financially and only
// returns the existing compensation to link against.
export async function applyCompensation(invoiceId: string, input: ApplyCompensationInput): Promise<BackorderCompensation | null> {
  const result = await prisma.$transaction((tx) => applyCompensationTx(tx, invoiceId, input))
  if (result.newRefund) {
    await notifyAdminFinancialActionRequired(invoiceId, result.newRefund)
  }
  // [Roadmap] Payment-change safety -- a backorder compensation changes
  // the invoice balance; if a storefront Order is still PENDING on an
  // open Stripe Checkout Session for this same invoice, that session's
  // fixed amount is now stale and must never remain payable. No-ops
  // immediately for the ordinary case (no linked Order, or one that's
  // already paid/settled). See lib/payments/staleSessionGuard.ts.
  await invalidateStaleCheckoutSessionForInvoice(invoiceId, 'Backorder compensation applied')
  return result.compensation
}

// The transaction-scoped core, factored out so applyBackorder can run
// condition-creation + compensation + the join row as one atomic write
// instead of three separate transactions that could partially fail.
async function applyCompensationTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  input: ApplyCompensationInput
): Promise<ApplyCompensationTxResult> {
  const amount = input.amount ?? BACKORDER_COMPENSATION_AMOUNT
  const compensationType: BackorderCompensationType = input.compensationType ?? 'AUTOMATIC'
  // The InvoiceDiscount label (and thus what a customer sees as the line
  // item, in both admin and the Customer Portal) is always this fixed,
  // type-specific string — never the admin's free-text reason, which may
  // contain internal notes and is never shown to the customer. `reason`
  // itself (an admin-entered explanation, defaulting to the same label
  // when not given) is stored on BackorderCompensation/InvoiceRefund for
  // the internal audit trail only.
  const discountLabel = compensationType === 'DISCRETIONARY' ? BACKORDER_ACCOMMODATION_LABEL : BACKORDER_COMPENSATION_LABEL
  const reason = input.reason ?? discountLabel
  const preference = input.preference ?? 'REFUND'

  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  // Scoped by type AND excludes reversed rows — AUTOMATIC and
  // DISCRETIONARY are independently idempotent, and a reversed
  // compensation never blocks a fresh one of the same type from being
  // created again (e.g. after an admin removes a discretionary
  // accommodation, a later one is a brand-new grant, not a "link to the
  // reversed one").
  const existing = await tx.backorderCompensation.findFirst({ where: { invoiceId, compensationType, reversedAt: null } })

  // The $100 minimum only gates the AUTOMATIC policy credit, and only when
  // this would be a brand-new grant (an already-existing automatic
  // compensation is never retroactively revoked just because the invoice
  // total later changed, e.g. from a partial refund). Evaluated against
  // invoice.total as read here -- i.e. before this compensation's own
  // discount could ever be created -- so the credit can never affect its
  // own eligibility. DISCRETIONARY amounts are never gated by this check;
  // that's the entire point of the separate manual workflow.
  if (!existing && compensationType === 'AUTOMATIC' && !isAutomaticCompensationEligible(invoice.total)) {
    return { compensation: null, isNew: false, skippedReason: 'BELOW_MINIMUM_ORDER_TOTAL', newRefund: null }
  }

  const disposition = decideCompensationDisposition({
    existingCompensationId: existing?.id ?? null,
    compensationAmount: amount,
    balanceDue: invoice.balanceDue,
    amountPaid: invoice.amountPaid,
    preference,
  })

  if (disposition.kind === 'LINK_EXISTING') {
    const compensation = await tx.backorderCompensation.findUniqueOrThrow({ where: { id: disposition.compensationId } })
    return { compensation, isNew: false, skippedReason: null, newRefund: null }
  }

  const { split } = disposition
  let discountId: string | undefined
  let refundId: string | undefined
  let accountCreditId: string | undefined
  let newRefund: InvoiceRefund | null = null

  if (split.creditAppliedAmount > 0) {
    const discount = await tx.invoiceDiscount.create({
      data: {
        invoiceId,
        label: discountLabel,
        type: 'FIXED',
        amount: split.creditAppliedAmount,
        appliedAmount: split.creditAppliedAmount,
      },
    })
    discountId = discount.id
  }

  if (split.refundAmount > 0) {
    // Always created PENDING — see the module-level comment. Nothing here
    // ever marks a refund COMPLETED; only completeRefund() (an explicit,
    // separate admin action) does that.
    const refund = await tx.invoiceRefund.create({
      data: {
        invoiceId,
        requestedAmount: split.refundAmount,
        status: 'PENDING',
        reason,
        requestedAt: new Date(),
        requestedBy: input.appliedBy,
      },
    })
    refundId = refund.id
    newRefund = refund
  }

  if (split.accountCreditAmount > 0) {
    if (!invoice.customerId) {
      throw new Error(
        'This backorder compensation includes an account-credit portion, but the invoice has no linked customer to credit — link a customer to this invoice first.'
      )
    }
    const accountCredit = await tx.customerAccountCredit.create({
      data: {
        customerId: invoice.customerId,
        amount: split.accountCreditAmount,
        remainingAmount: split.accountCreditAmount,
        reason,
        sourceInvoiceId: invoiceId,
        issuedAt: new Date(),
        issuedBy: input.appliedBy,
      },
    })
    accountCreditId = accountCredit.id
  }

  const compensation = await tx.backorderCompensation.create({
    data: {
      invoiceId,
      compensationType,
      totalAmount: amount,
      creditAppliedAmount: split.creditAppliedAmount,
      refundAmount: split.refundAmount,
      accountCreditAmount: split.accountCreditAmount,
      dispositionPreference: preference,
      reason,
      appliedAt: new Date(),
      appliedBy: input.appliedBy,
      discountId,
      refundId,
      accountCreditId,
    },
  })

  if (discountId) {
    await recalculateInvoiceFinancials(tx, invoiceId)
  }

  return { compensation, isNew: true, skippedReason: null, newRefund }
}

// Fired once, only when this exact call created a brand-new PENDING refund
// obligation — never on a linked/reused compensation, so admins aren't
// re-alerted every time another item on the same order links to a refund
// they've already been told about.
async function notifyAdminFinancialActionRequired(invoiceId: string, refund: InvoiceRefund): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)

  let emailSent = false
  if (emailTargets.length > 0) {
    const result = await sendCategorizedEmail(
      {
        category: 'REFUND_ACTION_REQUIRED',
        to: emailTargets.map((r) => r.email!),
        subject: backorderFinancialActionRequiredSubject(invoice.invoiceNumber),
        html: buildBackorderFinancialActionRequiredHtml({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.id,
          refundId: refund.id,
          clientName: invoice.customerName,
          refundAmount: refund.requestedAmount,
          reason: refund.reason,
          appUrl: APP_URL,
        }),
      },
      { customerId: invoice.customerId, invoiceId: invoice.id, relatedRefundId: refund.id, actorType: 'SYSTEM' }
    )
    emailSent = result.sent
  }

  await logInvoiceAndCustomerEvent(
    invoice,
    'BACKORDER_REFUND_ACTION_REQUIRED',
    emailSent ? `Admin notified — ${formatMoney(refund.requestedAmount)} pending refund` : 'No admin recipients configured'
  )
}

// Truthful, never-overstating notice: describes exactly what financial
// action was actually taken (credit applied / refund pending / account
// credit issued) using the compensation's real current amounts — a pending
// refund is always described as "being processed," never as completed.
async function sendBackorderNoticeEmail(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string },
  condition: { id: string; productName: string; expectedAvailableDate: Date | null },
  compensation: BackorderCompensation | null
): Promise<void> {
  if (!invoice.customerEmail) return

  const lines: string[] = []
  // Null exactly when the AUTOMATIC policy didn't qualify (invoice at or
  // under the $100 minimum) -- the notice still goes out describing the
  // backorder itself, just with no compensation lines, never a false claim
  // of credit/refund/account-credit that didn't happen.
  if (compensation?.creditAppliedAmount) {
    lines.push(`A ${formatMoney(compensation.creditAppliedAmount)} credit has been applied to your remaining balance on this invoice.`)
  }
  if (compensation?.refundAmount) {
    lines.push(
      `A ${formatMoney(compensation.refundAmount)} refund is being processed and will be completed within a few business days — we'll send a separate confirmation once it's done.`
    )
  }
  if (compensation?.accountCreditAmount) {
    lines.push(`A ${formatMoney(compensation.accountCreditAmount)} credit has been added to your account for a future order.`)
  }

  await sendCategorizedEmail(
    {
      category: 'BACKORDER_NOTICE',
      to: invoice.customerEmail,
      subject: backorderNoticeSubject(invoice.invoiceNumber),
      html: buildBackorderNoticeHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        productName: condition.productName,
        expectedAvailableDate: condition.expectedAvailableDate,
        compensationLines: lines,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, relatedBackorderConditionId: condition.id, actorType: 'SYSTEM' }
  )
}

export interface ApplyBackorderInput {
  invoiceId: string
  invoiceItemId: string
  appliedBy: string
  expectedAvailableDate?: Date | null
  notes?: string | null
  // Only meaningful the first time compensation is created on an invoice
  // that's already collected some or all of its total — see
  // lib/invoice/backorder.ts's computeCompensationSplit. Defaults to
  // 'REFUND' (a pending obligation), matching prior behavior.
  preference?: CompensationDispositionPreference
  // Optional, defaults to 'MANUAL' -- every pre-existing caller is a real
  // admin action and stays byte-for-byte unaffected. The first automated
  // caller (storefront checkout, applying a backorder the instant a
  // shortfall is detected -- see this function's own comment below) passes
  // 'SYSTEM' so the resulting CustomerActivityLog/InvoiceActivityLog entries
  // accurately show no admin was actually involved, rather than the
  // misleading "MANUAL" this codebase's automatic $25 compensation policy
  // already treats as a non-admin-judgment action anyway.
  source?: TrackingEventSource
}

// Section: admin manually marks a line item backordered. Validates the item
// actually belongs to this invoice (never trusts a client-supplied id blindly
// — same posture as lib/invoice/rowSync.ts), snapshots the product name so
// the record stays meaningful even if the line item is later removed,
// applies/links the one-per-invoice compensation, and joins the two. Future
// inventory automation is expected to call this exact function too, never a
// parallel path, so every backorder — manual or automatic — gets the same
// compensation and fulfillment-block guarantees.
export async function applyBackorder(input: ApplyBackorderInput) {
  const item = await prisma.invoiceItem.findUniqueOrThrow({ where: { id: input.invoiceItemId } })
  if (item.invoiceId !== input.invoiceId) {
    throw new Error('This line item does not belong to the specified invoice')
  }

  const alreadyActive = await prisma.backorderCondition.findFirst({
    where: { invoiceItemId: input.invoiceItemId, status: 'ACTIVE' },
  })
  if (alreadyActive) {
    throw new Error('This line item already has an active backorder')
  }

  // Condition creation, compensation, and the join row all happen in one
  // transaction — a failure partway through (e.g. the account-credit
  // guard above) rolls back the condition too, instead of leaving an
  // orphaned BackorderCondition with no compensation link.
  const { condition, compensationResult } = await prisma.$transaction(async (tx) => {
    const created = await tx.backorderCondition.create({
      data: {
        invoiceId: input.invoiceId,
        invoiceItemId: input.invoiceItemId,
        productName: item.name,
        // Additive (Inventory & Pricing MVP) -- snapshotted here, same
        // reasoning as productName above: a later change to the product's
        // unitsPerCase, or the item being edited, must never rewrite what
        // this specific backorder actually represented at the time it was
        // applied. Both stay null for a line item with no catalog product
        // or no inventory-quantity snapshot (e.g. free-typed line items).
        productId: item.productId ?? undefined,
        vialsBackordered: item.inventoryQuantityConsumed ?? undefined,
        status: 'ACTIVE',
        expectedAvailableDate: input.expectedAvailableDate ?? undefined,
        appliedAt: new Date(),
        appliedBy: input.appliedBy,
        notes: input.notes ?? undefined,
      },
    })

    const compResult = await applyCompensationTx(tx, input.invoiceId, {
      appliedBy: input.appliedBy,
      preference: input.preference,
      compensationType: 'AUTOMATIC',
    })

    // Null exactly when the invoice doesn't exceed the $100 minimum -- the
    // BackorderCondition itself is still recorded (a real fulfillment
    // shortage exists regardless of compensation eligibility); there's just
    // no compensation row to join it to.
    if (compResult.compensation) {
      await tx.backorderConditionCompensation.create({
        data: { backorderConditionId: created.id, backorderCompensationId: compResult.compensation.id },
      })
    }

    return { condition: created, compensationResult: compResult }
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } })
  const activityNote = `${item.name} — expected ${input.expectedAvailableDate ? input.expectedAvailableDate.toDateString() : 'date TBD'}`
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: input.invoiceId,
      eventType: 'BACKORDER_APPLIED',
      newValue: activityNote,
      source: input.source ?? 'MANUAL',
      userId: input.appliedBy,
    })
  } else {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: input.invoiceId, eventType: 'BACKORDER_APPLIED', newValue: activityNote, source: input.source ?? 'MANUAL', userId: input.appliedBy },
    })
  }

  if (compensationResult.newRefund) {
    await notifyAdminFinancialActionRequired(input.invoiceId, compensationResult.newRefund)
  }
  if (compensationResult.skippedReason === 'BELOW_MINIMUM_ORDER_TOTAL') {
    // Traceable, not silent: an admin looking at this invoice's timeline
    // should be able to see exactly why no automatic $25 credit appeared,
    // rather than wondering if the policy simply didn't run.
    await prisma.invoiceActivityLog.create({
      data: {
        invoiceId: input.invoiceId,
        eventType: 'BACKORDER_AUTOMATIC_COMPENSATION_NOT_APPLIED',
        newValue: `Invoice total ${formatMoney(invoice.total)} does not exceed the $${BACKORDER_AUTOMATIC_MINIMUM_ORDER_TOTAL} minimum for the automatic $${BACKORDER_COMPENSATION_AMOUNT} backorder credit`,
        source: 'SYSTEM',
      },
    })
  }
  await sendBackorderNoticeEmail(invoice, condition, compensationResult.compensation)
  // [Roadmap] Payment-change safety -- see applyCompensation's identical call.
  await invalidateStaleCheckoutSessionForInvoice(input.invoiceId, 'Backorder applied')

  return condition
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export class DiscretionaryAccommodationError extends Error {}

export interface BackorderCompensationSummary {
  automatic: BackorderCompensation | null
  discretionary: BackorderCompensation | null
}

// The "show existing compensation before applying another" lookup — one
// read, both types, so the admin UI can render "Automatic Backorder
// Credit: $25 / Manual Backorder Accommodation: $10" (or either/neither)
// before an admin ever submits a new accommodation.
export async function getBackorderCompensationSummary(invoiceId: string): Promise<BackorderCompensationSummary> {
  const [automatic, discretionary] = await Promise.all([
    prisma.backorderCompensation.findFirst({ where: { invoiceId, compensationType: 'AUTOMATIC', reversedAt: null } }),
    prisma.backorderCompensation.findFirst({ where: { invoiceId, compensationType: 'DISCRETIONARY', reversedAt: null } }),
  ])
  return { automatic, discretionary }
}

export interface AccommodationPreview {
  split: CompensationSplit
  currentTotal: number
  projectedTotal: number
  currentBalanceDue: number
  projectedBalanceDue: number
  existing: BackorderCompensationSummary
}

// Read-only — computes the effect of a candidate discretionary amount
// without writing anything, so the admin UI can show "invoice becomes
// $79.00" before the admin confirms. Uses the same pure
// computeCompensationSplit the real apply path uses, so the preview can
// never drift from what actually happens on confirm.
export async function previewDiscretionaryAccommodation(
  invoiceId: string,
  amount: number,
  preference?: CompensationDispositionPreference
): Promise<AccommodationPreview> {
  const [invoice, existing] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
    getBackorderCompensationSummary(invoiceId),
  ])
  const split = computeCompensationSplit({
    compensationAmount: amount,
    balanceDue: invoice.balanceDue,
    amountPaid: invoice.amountPaid,
    preference,
  })
  return {
    split,
    currentTotal: invoice.total,
    projectedTotal: round2(invoice.total - split.creditAppliedAmount),
    currentBalanceDue: invoice.balanceDue,
    projectedBalanceDue: round2(Math.max(0, invoice.balanceDue - split.creditAppliedAmount)),
    existing,
  }
}

async function notifyCustomerOfAccommodation(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string; balanceDue: number },
  compensation: BackorderCompensation,
  actor: string
): Promise<void> {
  if (!invoice.customerEmail) return
  const portalUrl = invoice.customerId ? `${APP_URL}/account` : null
  await sendCategorizedEmail(
    {
      category: 'BACKORDER_ACCOMMODATION',
      to: invoice.customerEmail,
      subject: backorderAccommodationSubject(invoice.invoiceNumber),
      html: buildBackorderAccommodationHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        accommodationAmount: compensation.totalAmount,
        revisedBalanceDue: invoice.balanceDue,
        reason: compensation.reason,
        portalUrl,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, actorType: 'MANUAL', actorUserId: actor }
  )
}

export interface ApplyDiscretionaryAccommodationInput {
  amount: number
  reason: string
  appliedBy: string
  preference?: CompensationDispositionPreference
}

// The real-time customer-service path: an admin-entered custom amount,
// completely independent of the $100 automatic-policy minimum -- that's
// the entire point of this being a separate function rather than a
// parameter on applyCompensation. Never gated by isAutomaticCompensationEligible.
// Blocked when a non-reversed DISCRETIONARY compensation already exists on
// this invoice (use adjustDiscretionaryAccommodation instead) -- this is
// what prevents an accidental duplicate; the AUTOMATIC $25 (if any) is
// entirely unaffected and untouched by this function.
export async function applyDiscretionaryAccommodation(
  invoiceId: string,
  input: ApplyDiscretionaryAccommodationInput
): Promise<BackorderCompensation> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new DiscretionaryAccommodationError('Enter a valid accommodation amount greater than $0.')
  }
  if (!input.reason.trim()) {
    throw new DiscretionaryAccommodationError('A reason is required for a discretionary backorder accommodation.')
  }

  const existing = await prisma.backorderCompensation.findFirst({
    where: { invoiceId, compensationType: 'DISCRETIONARY', reversedAt: null },
  })
  if (existing) {
    throw new DiscretionaryAccommodationError(
      'This invoice already has an active discretionary backorder accommodation — adjust or remove it instead of applying a new one.'
    )
  }

  const result = await prisma.$transaction((tx) =>
    applyCompensationTx(tx, invoiceId, {
      amount: input.amount,
      reason: input.reason,
      appliedBy: input.appliedBy,
      preference: input.preference,
      compensationType: 'DISCRETIONARY',
    })
  )
  // Never null here: DISCRETIONARY is never gated by the $100 minimum, and
  // the check above already confirmed there's no existing row to link to
  // instead of creating a new one.
  const compensation = result.compensation!

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  await logInvoiceAndCustomerEvent(
    invoice,
    'BACKORDER_ACCOMMODATION_APPLIED',
    `${formatMoney(compensation.totalAmount)} — ${compensation.reason} — revised balance ${formatMoney(invoice.balanceDue)}`,
    input.appliedBy
  )
  await notifyCustomerOfAccommodation(invoice, compensation, input.appliedBy)

  if (result.newRefund) {
    await notifyAdminFinancialActionRequired(invoiceId, result.newRefund)
  }
  // [Roadmap] Payment-change safety -- see applyCompensation's identical call.
  await invalidateStaleCheckoutSessionForInvoice(invoiceId, 'Discretionary backorder accommodation applied')

  return compensation
}

export interface AdjustDiscretionaryAccommodationInput {
  newAmount: number
  reason: string
  actor: string
  preference?: CompensationDispositionPreference
}

// Never mutates the old compensation row's financial fields in place —
// marks it reversed (reversedAt/reversedBy/reversalReason), detaches and
// deletes its InvoiceDiscount (so the invoice total no longer reflects
// it), then creates a brand-new DISCRETIONARY compensation for the new
// amount. The full history — what was originally granted, when, by whom,
// and why it changed — is always reconstructable from the two rows.
export async function adjustDiscretionaryAccommodation(
  compensationId: string,
  input: AdjustDiscretionaryAccommodationInput
): Promise<BackorderCompensation> {
  if (!Number.isFinite(input.newAmount) || input.newAmount <= 0) {
    throw new DiscretionaryAccommodationError('Enter a valid accommodation amount greater than $0.')
  }

  const existing = await prisma.backorderCompensation.findUniqueOrThrow({ where: { id: compensationId } })
  if (existing.compensationType !== 'DISCRETIONARY') {
    throw new DiscretionaryAccommodationError('Only a discretionary accommodation can be adjusted — the automatic policy credit is not editable.')
  }
  if (existing.reversedAt) {
    throw new DiscretionaryAccommodationError('This accommodation has already been reversed.')
  }
  if (existing.refundId || existing.accountCreditId) {
    throw new DiscretionaryAccommodationError(
      'This accommodation includes a refund or account-credit portion — use the refund/account-credit workflow to change it instead of adjusting it directly.'
    )
  }

  const invoiceId = existing.invoiceId

  await prisma.$transaction(async (tx) => {
    await tx.backorderCompensation.update({
      where: { id: existing.id },
      data: {
        reversedAt: new Date(),
        reversedBy: input.actor,
        reversalReason: `Adjusted to ${formatMoney(input.newAmount)} — ${input.reason}`,
        discountId: null,
      },
    })
    if (existing.discountId) {
      await tx.invoiceDiscount.delete({ where: { id: existing.discountId } })
    }
    await recalculateInvoiceFinancials(tx, invoiceId)
  })

  const result = await prisma.$transaction((tx) =>
    applyCompensationTx(tx, invoiceId, {
      amount: input.newAmount,
      reason: input.reason,
      appliedBy: input.actor,
      preference: input.preference,
      compensationType: 'DISCRETIONARY',
    })
  )
  const compensation = result.compensation!

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  await logInvoiceAndCustomerEvent(
    invoice,
    'BACKORDER_ACCOMMODATION_ADJUSTED',
    `${formatMoney(existing.totalAmount)} → ${formatMoney(compensation.totalAmount)} — revised balance ${formatMoney(invoice.balanceDue)}`,
    input.actor
  )
  await notifyCustomerOfAccommodation(invoice, compensation, input.actor)

  if (result.newRefund) {
    await notifyAdminFinancialActionRequired(invoiceId, result.newRefund)
  }
  // [Roadmap] Payment-change safety -- see applyCompensation's identical call.
  await invalidateStaleCheckoutSessionForInvoice(invoiceId, 'Discretionary backorder accommodation adjusted')

  return compensation
}

export interface RemoveDiscretionaryAccommodationInput {
  actor: string
  reason: string
}

export async function removeDiscretionaryAccommodation(
  compensationId: string,
  input: RemoveDiscretionaryAccommodationInput
): Promise<void> {
  const existing = await prisma.backorderCompensation.findUniqueOrThrow({ where: { id: compensationId } })
  if (existing.compensationType !== 'DISCRETIONARY') {
    throw new DiscretionaryAccommodationError('Only a discretionary accommodation can be removed — the automatic policy credit is not editable.')
  }
  if (existing.reversedAt) {
    throw new DiscretionaryAccommodationError('This accommodation has already been reversed.')
  }
  if (existing.refundId || existing.accountCreditId) {
    throw new DiscretionaryAccommodationError(
      'This accommodation includes a refund or account-credit portion — use the refund/account-credit workflow to reverse it instead.'
    )
  }

  const invoiceId = existing.invoiceId
  await prisma.$transaction(async (tx) => {
    await tx.backorderCompensation.update({
      where: { id: existing.id },
      data: { reversedAt: new Date(), reversedBy: input.actor, reversalReason: input.reason, discountId: null },
    })
    if (existing.discountId) {
      await tx.invoiceDiscount.delete({ where: { id: existing.discountId } })
    }
    await recalculateInvoiceFinancials(tx, invoiceId)
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  await logInvoiceAndCustomerEvent(
    invoice,
    'BACKORDER_ACCOMMODATION_REMOVED',
    `${formatMoney(existing.totalAmount)} — ${input.reason} — revised balance ${formatMoney(invoice.balanceDue)}`,
    input.actor
  )
  // [Roadmap] Payment-change safety -- see applyCompensation's identical call.
  await invalidateStaleCheckoutSessionForInvoice(invoiceId, 'Discretionary backorder accommodation removed')
}

export interface ResolveBackorderInput {
  resolvedBy: string
  resolutionNote?: string | null
}

// Fills in the resolution fields on the same row rather than deleting or
// recreating it — full history (including this and any past resolved
// backorders on the invoice) is always preserved. Compensation, its notes,
// and its history are never touched by resolution — the credit/refund stays
// on record regardless of what happens to the backorder condition itself.
export async function resolveBackorder(backorderConditionId: string, input: ResolveBackorderInput) {
  const condition = await prisma.backorderCondition.findUniqueOrThrow({ where: { id: backorderConditionId } })
  if (condition.status !== 'ACTIVE') {
    throw new Error('This backorder is not currently active')
  }

  const resolved = await prisma.backorderCondition.update({
    where: { id: backorderConditionId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy,
      resolutionNote: input.resolutionNote ?? undefined,
    },
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: condition.invoiceId } })
  const activityNote = `${condition.productName}${input.resolutionNote ? ` — ${input.resolutionNote}` : ''}`
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: condition.invoiceId,
      eventType: 'BACKORDER_RESOLVED',
      newValue: activityNote,
      source: 'MANUAL',
      userId: input.resolvedBy,
    })
  } else {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: condition.invoiceId, eventType: 'BACKORDER_RESOLVED', newValue: activityNote, source: 'MANUAL', userId: input.resolvedBy },
    })
  }

  await sendBackorderResolvedEmail(invoice, condition, input.resolvedBy)

  return resolved
}

async function sendBackorderResolvedEmail(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string },
  condition: { id: string; productName: string },
  resolvedBy: string
): Promise<void> {
  if (!invoice.customerEmail) return
  await sendCategorizedEmail(
    {
      category: 'BACKORDER_NOTICE',
      to: invoice.customerEmail,
      subject: backorderResolvedSubject(invoice.invoiceNumber),
      html: buildBackorderResolvedHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        productName: condition.productName,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, relatedBackorderConditionId: condition.id, actorType: 'MANUAL', actorUserId: resolvedBy }
  )
}

export async function listBackordersForInvoice(invoiceId: string) {
  return prisma.backorderCondition.findMany({
    where: { invoiceId },
    orderBy: { appliedAt: 'desc' },
    include: {
      compensationLinks: {
        include: {
          backorderCompensation: {
            include: { refund: true, accountCredit: true },
          },
        },
      },
    },
  })
}

export interface CompleteRefundInput {
  completedBy: string
  // Defaults to the refund's full requestedAmount — override only when less
  // than the full amount was actually returned.
  completedAmount?: number
  providerTransactionId?: string
}

// The only place a refund is ever marked COMPLETED, and the only place
// Invoice.amountRefunded ever moves — canTransitionRefundStatus (a pure,
// tested rule) guards against completing an already-terminal refund twice.
// Sends the customer's completed-refund confirmation only after the DB
// write has actually committed, never before.
export async function completeRefund(refundId: string, input: CompleteRefundInput) {
  const { refund, invoice, isBackorderOriginated } = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({
      where: { id: refundId },
      include: { backorderCompensation: true },
    })
    if (!canTransitionRefundStatus(existing.status)) {
      throw new Error(`This refund is already ${existing.status.toLowerCase().replace('_', ' ')} and cannot be completed`)
    }

    const completedAmount = input.completedAmount ?? existing.requestedAmount
    const updatedRefund = await tx.invoiceRefund.update({
      where: { id: refundId },
      data: {
        status: 'COMPLETED',
        completedAmount,
        completedAt: new Date(),
        completedBy: input.completedBy,
        providerTransactionId: input.providerTransactionId ?? undefined,
      },
    })
    const updatedInvoice = await tx.invoice.update({
      where: { id: existing.invoiceId },
      data: { amountRefunded: { increment: completedAmount } },
    })
    return { refund: updatedRefund, invoice: updatedInvoice, isBackorderOriginated: existing.backorderCompensation !== null }
  })

  await logInvoiceAndCustomerEvent(
    invoice,
    isBackorderOriginated ? 'BACKORDER_REFUND_COMPLETED' : 'REFUND_COMPLETED',
    `${formatMoney(refund.completedAmount ?? refund.requestedAmount)}${refund.method ? ` via ${refund.method}` : ''}`,
    input.completedBy
  )
  await sendRefundCompletedEmail(invoice, refund)

  return refund
}

async function sendRefundCompletedEmail(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string },
  refund: InvoiceRefund
): Promise<void> {
  if (!invoice.customerEmail) return
  await sendCategorizedEmail(
    {
      category: 'REFUND_COMPLETED',
      to: invoice.customerEmail,
      subject: refundCompletedSubject(invoice.invoiceNumber),
      html: buildRefundCompletedHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        amount: refund.completedAmount ?? refund.requestedAmount,
        method: refund.method,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, relatedRefundId: refund.id, actorType: 'MANUAL', actorUserId: refund.completedBy }
  )
}

export interface FailRefundInput {
  failedBy: string
  failureReason: string
}

export async function failRefund(refundId: string, input: FailRefundInput) {
  const { refund, isBackorderOriginated } = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({
      where: { id: refundId },
      include: { backorderCompensation: true },
    })
    if (!canTransitionRefundStatus(existing.status)) {
      throw new Error(`This refund is already ${existing.status.toLowerCase().replace('_', ' ')} and cannot be marked failed`)
    }
    const updated = await tx.invoiceRefund.update({
      where: { id: refundId },
      data: { status: 'FAILED', failureReason: input.failureReason },
    })
    return { refund: updated, isBackorderOriginated: existing.backorderCompensation !== null }
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } })
  await logInvoiceAndCustomerEvent(
    invoice,
    isBackorderOriginated ? 'BACKORDER_REFUND_FAILED' : 'REFUND_FAILED',
    input.failureReason,
    input.failedBy
  )

  return refund
}

export interface CancelRefundInput {
  cancelledBy: string
}

export async function cancelRefund(refundId: string, input: CancelRefundInput) {
  const { refund, isBackorderOriginated } = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({
      where: { id: refundId },
      include: { backorderCompensation: true },
    })
    if (!canTransitionRefundStatus(existing.status)) {
      throw new Error(`This refund is already ${existing.status.toLowerCase().replace('_', ' ')} and cannot be cancelled`)
    }
    const updated = await tx.invoiceRefund.update({
      where: { id: refundId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: input.cancelledBy },
    })
    return { refund: updated, isBackorderOriginated: existing.backorderCompensation !== null }
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } })
  await logInvoiceAndCustomerEvent(
    invoice,
    isBackorderOriginated ? 'BACKORDER_REFUND_CANCELLED' : 'REFUND_CANCELLED',
    undefined,
    input.cancelledBy
  )

  return refund
}
