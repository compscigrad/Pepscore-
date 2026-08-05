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
import { Prisma, type DeliveryStatus, type CompensationDispositionPreference, type InvoiceRefund, type BackorderCompensation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceLineItemInput, type InvoiceDiscountInput } from '@/lib/invoice/calculations'
import { deriveInvoicePaymentAmounts, deriveInvoiceWorkflowStatus } from '@/lib/invoice/status'
import { computeOrderStatus } from '@/lib/tracking/orderStatus'
import { decideCompensationDisposition, isDeliveryStatusBlockedByBackorder, canTransitionRefundStatus } from '@/lib/invoice/backorder'
import { syncCustomerFromInvoiceEvent, recordCustomerActivity } from '@/lib/customers'
import { resend, FROM_EMAIL, BILLING_EMAIL } from '@/lib/resend'
import { backorderNoticeSubject, buildBackorderNoticeHtml, refundCompletedSubject, buildRefundCompletedHtml } from '@/emails/BackorderNotice'
import { backorderFinancialActionRequiredSubject, buildBackorderFinancialActionRequiredHtml } from '@/emails/AdminBackorderAlerts'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export const BACKORDER_COMPENSATION_AMOUNT = 25
export const BACKORDER_COMPENSATION_LABEL = 'Backorder Service Credit'

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
  compensation: BackorderCompensation
  isNew: boolean
  // Only set when a brand-new PENDING refund obligation was just created in
  // this call — never set on a LINK_EXISTING reuse, so callers know exactly
  // when (and only when) the "manual refund required" admin alert applies.
  newRefund: InvoiceRefund | null
}

// The single choke point for the flat backorder compensation: idempotent
// per invoice (decideCompensationDisposition), and disposes the amount as
// credit/refund-obligation/account-credit strictly by the invoice's payment
// state and the admin's chosen preference at this exact moment
// (lib/invoice/backorder.ts's split algorithm) — never a fabricated
// completed refund against an InvoiceDiscount, never a silently dropped
// credit, and never an auto-completed cash refund with no provider behind
// it. Safe to call once per newly-discovered backorder on an invoice; every
// call after the first on the same invoice is a no-op financially and only
// returns the existing compensation to link against.
export async function applyCompensation(
  invoiceId: string,
  input: { amount?: number; reason?: string; appliedBy: string; preference?: CompensationDispositionPreference }
): Promise<BackorderCompensation> {
  const result = await prisma.$transaction((tx) => applyCompensationTx(tx, invoiceId, input))
  if (result.newRefund) {
    await notifyAdminFinancialActionRequired(invoiceId, result.newRefund)
  }
  return result.compensation
}

// The transaction-scoped core, factored out so applyBackorder can run
// condition-creation + compensation + the join row as one atomic write
// instead of three separate transactions that could partially fail.
async function applyCompensationTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  input: { amount?: number; reason?: string; appliedBy: string; preference?: CompensationDispositionPreference }
): Promise<ApplyCompensationTxResult> {
  const amount = input.amount ?? BACKORDER_COMPENSATION_AMOUNT
  const reason = input.reason ?? BACKORDER_COMPENSATION_LABEL
  const preference = input.preference ?? 'REFUND'

  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const existing = await tx.backorderCompensation.findFirst({ where: { invoiceId } })

  const disposition = decideCompensationDisposition({
    existingCompensationId: existing?.id ?? null,
    compensationAmount: amount,
    balanceDue: invoice.balanceDue,
    amountPaid: invoice.amountPaid,
    preference,
  })

  if (disposition.kind === 'LINK_EXISTING') {
    const compensation = await tx.backorderCompensation.findUniqueOrThrow({ where: { id: disposition.compensationId } })
    return { compensation, isNew: false, newRefund: null }
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
        label: BACKORDER_COMPENSATION_LABEL,
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

  return { compensation, isNew: true, newRefund }
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
  try {
    if (emailTargets.length > 0) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: emailTargets.map((r) => r.email!),
        replyTo: BILLING_EMAIL,
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
      })
      emailSent = true
    }
  } catch (err) {
    console.error('[backorders] admin financial-action-required email failed:', err)
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
  invoice: { customerEmail: string | null; customerName: string; invoiceNumber: string },
  condition: { productName: string; expectedAvailableDate: Date | null },
  compensation: BackorderCompensation
): Promise<void> {
  if (!invoice.customerEmail) return

  const lines: string[] = []
  if (compensation.creditAppliedAmount > 0) {
    lines.push(`A ${formatMoney(compensation.creditAppliedAmount)} credit has been applied to your remaining balance on this invoice.`)
  }
  if (compensation.refundAmount > 0) {
    lines.push(
      `A ${formatMoney(compensation.refundAmount)} refund is being processed and will be completed within a few business days — we'll send a separate confirmation once it's done.`
    )
  }
  if (compensation.accountCreditAmount > 0) {
    lines.push(`A ${formatMoney(compensation.accountCreditAmount)} credit has been added to your account for a future order.`)
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: invoice.customerEmail,
      replyTo: BILLING_EMAIL,
      subject: backorderNoticeSubject(invoice.invoiceNumber),
      html: buildBackorderNoticeHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        productName: condition.productName,
        expectedAvailableDate: condition.expectedAvailableDate,
        compensationLines: lines,
      }),
    })
  } catch (err) {
    console.error('[backorders] backorder-notice email failed:', err)
  }
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
    })

    await tx.backorderConditionCompensation.create({
      data: { backorderConditionId: created.id, backorderCompensationId: compResult.compensation.id },
    })

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
      source: 'MANUAL',
      userId: input.appliedBy,
    })
  } else {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: input.invoiceId, eventType: 'BACKORDER_APPLIED', newValue: activityNote, source: 'MANUAL', userId: input.appliedBy },
    })
  }

  if (compensationResult.newRefund) {
    await notifyAdminFinancialActionRequired(input.invoiceId, compensationResult.newRefund)
  }
  await sendBackorderNoticeEmail(invoice, condition, compensationResult.compensation)

  return condition
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

  return resolved
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
  const { refund, invoice } = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({ where: { id: refundId } })
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
    return { refund: updatedRefund, invoice: updatedInvoice }
  })

  await logInvoiceAndCustomerEvent(
    invoice,
    'BACKORDER_REFUND_COMPLETED',
    `${formatMoney(refund.completedAmount ?? refund.requestedAmount)}${refund.method ? ` via ${refund.method}` : ''}`,
    input.completedBy
  )
  await sendRefundCompletedEmail(invoice, refund)

  return refund
}

async function sendRefundCompletedEmail(
  invoice: { customerEmail: string | null; customerName: string; invoiceNumber: string },
  refund: InvoiceRefund
): Promise<void> {
  if (!invoice.customerEmail) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: invoice.customerEmail,
      replyTo: BILLING_EMAIL,
      subject: refundCompletedSubject(invoice.invoiceNumber),
      html: buildRefundCompletedHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        amount: refund.completedAmount ?? refund.requestedAmount,
        method: refund.method,
      }),
    })
  } catch (err) {
    console.error('[backorders] refund-completed email failed:', err)
  }
}

export interface FailRefundInput {
  failedBy: string
  failureReason: string
}

export async function failRefund(refundId: string, input: FailRefundInput) {
  const refund = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({ where: { id: refundId } })
    if (!canTransitionRefundStatus(existing.status)) {
      throw new Error(`This refund is already ${existing.status.toLowerCase().replace('_', ' ')} and cannot be marked failed`)
    }
    return tx.invoiceRefund.update({
      where: { id: refundId },
      data: { status: 'FAILED', failureReason: input.failureReason },
    })
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } })
  await logInvoiceAndCustomerEvent(invoice, 'BACKORDER_REFUND_FAILED', input.failureReason, input.failedBy)

  return refund
}

export interface CancelRefundInput {
  cancelledBy: string
}

export async function cancelRefund(refundId: string, input: CancelRefundInput) {
  const refund = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceRefund.findUniqueOrThrow({ where: { id: refundId } })
    if (!canTransitionRefundStatus(existing.status)) {
      throw new Error(`This refund is already ${existing.status.toLowerCase().replace('_', ' ')} and cannot be cancelled`)
    }
    return tx.invoiceRefund.update({
      where: { id: refundId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: input.cancelledBy },
    })
  })

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } })
  await logInvoiceAndCustomerEvent(invoice, 'BACKORDER_REFUND_CANCELLED', undefined, input.cancelledBy)

  return refund
}
