// Data access for the backorder + compensation workflow. Mirrors
// lib/paymentArrangements.ts's separation from lib/invoices.ts: this module
// owns backorder/compensation rows and only ever *adds* to an invoice's
// financial totals (via recalculateInvoiceFinancials, the same math
// lib/invoices.ts's updateInvoice already uses) rather than duplicating the
// authoritative total/balanceDue calculation.
import { Prisma, type DeliveryStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceLineItemInput, type InvoiceDiscountInput } from '@/lib/invoice/calculations'
import { deriveInvoicePaymentAmounts, deriveInvoiceWorkflowStatus } from '@/lib/invoice/status'
import { computeOrderStatus } from '@/lib/tracking/orderStatus'
import { decideCompensationDisposition, isDeliveryStatusBlockedByBackorder } from '@/lib/invoice/backorder'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'

export const BACKORDER_COMPENSATION_AMOUNT = 25
export const BACKORDER_COMPENSATION_LABEL = 'Backorder Service Credit'

// Thrown by assertDeliveryStatusAllowed — a business-rule failure, not a
// server error, same shape/intent as lib/invoices.ts's InvoiceIssuanceError
// (callers render a clean 4xx instead of a generic 500).
export class BackorderBlockedError extends Error {}

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

// The single choke point for the flat backorder compensation: idempotent
// per invoice (decideCompensationDisposition), and disposes the amount as
// credit/refund/account-credit strictly by the invoice's payment state at
// this exact moment (lib/invoice/backorder.ts's split algorithm) — never a
// fabricated refund against an InvoiceDiscount, never a silently dropped
// credit. Safe to call once per newly-discovered backorder on an invoice;
// every call after the first on the same invoice is a no-op financially and
// only returns the existing compensation to link against.
export async function applyCompensation(
  invoiceId: string,
  input: { amount?: number; reason?: string; appliedBy: string }
) {
  return prisma.$transaction((tx) => applyCompensationTx(tx, invoiceId, input))
}

// The transaction-scoped core, factored out so applyBackorder can run
// condition-creation + compensation + the join row as one atomic write
// instead of three separate transactions that could partially fail.
async function applyCompensationTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  input: { amount?: number; reason?: string; appliedBy: string }
) {
  const amount = input.amount ?? BACKORDER_COMPENSATION_AMOUNT
  const reason = input.reason ?? BACKORDER_COMPENSATION_LABEL

  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const existing = await tx.backorderCompensation.findFirst({ where: { invoiceId } })

  const disposition = decideCompensationDisposition({
    existingCompensationId: existing?.id ?? null,
    compensationAmount: amount,
    balanceDue: invoice.balanceDue,
    amountPaid: invoice.amountPaid,
  })

  if (disposition.kind === 'LINK_EXISTING') {
    return tx.backorderCompensation.findUniqueOrThrow({ where: { id: disposition.compensationId } })
  }

  const { split } = disposition
  let discountId: string | undefined
  let refundId: string | undefined
  let accountCreditId: string | undefined

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
    const refund = await tx.invoiceRefund.create({
      data: {
        invoiceId,
        amount: split.refundAmount,
        reason,
        processedAt: new Date(),
        processedBy: input.appliedBy,
      },
    })
    refundId = refund.id
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

  return compensation
}

export interface ApplyBackorderInput {
  invoiceId: string
  invoiceItemId: string
  appliedBy: string
  expectedAvailableDate?: Date | null
  notes?: string | null
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
  const condition = await prisma.$transaction(async (tx) => {
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

    const compensation = await applyCompensationTx(tx, input.invoiceId, { appliedBy: input.appliedBy })

    await tx.backorderConditionCompensation.create({
      data: { backorderConditionId: created.id, backorderCompensationId: compensation.id },
    })

    return created
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
    include: { compensationLinks: { include: { backorderCompensation: true } } },
  })
}
