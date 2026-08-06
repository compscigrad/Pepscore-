// Invoice data-access service. This is the ONLY module that queries Prisma
// for invoice data — API routes and pages call these functions, never
// `prisma.invoice.*` directly. That single seam is what lets storage move to
// something else later (per the spec's "should require minimal code changes")
// without touching any route or component.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceLineItemInput } from '@/lib/invoice/calculations'
import { planRowSync } from '@/lib/invoice/rowSync'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'
import { assertPaymentWithinBalance, type InvoicePayload, type PaymentPayload } from '@/lib/invoice/validation'
import {
  deriveInvoicePaymentAmounts,
  deriveInvoiceWorkflowStatus,
  deriveInitialPaymentIntentStatus,
  resolvePaymentIntentAfterPayment,
} from '@/lib/invoice/status'
import { getIntakeLinkState } from '@/lib/intakeLinkState'
import {
  matchPaymentToNextPendingInstallment,
  requestPaymentArrangement,
  approveArrangement,
  denyArrangement,
  type RequestPaymentArrangementInput,
  type ApproveArrangementOverrides,
} from '@/lib/paymentArrangements'
import { computeOrderStatus } from '@/lib/tracking/orderStatus'
import { sendInvoiceIssuedEmailIfNeeded, sendInvoiceIssuedSmsIfNeeded, sendInvoiceRevisedEmailIfNeeded } from '@/lib/invoiceIssuedEmail'
import { sendPaymentReceivedEmailIfNeeded } from '@/lib/paymentReceivedEmail'
import {
  notifyAdminPaymentSelectionPending,
  notifyClientPaymentSelectionConfirmation,
  notifyAdminArrangementRequestPending,
  notifyClientArrangementRequestReceived,
  notifyClientArrangementApproved,
  notifyClientArrangementDenied,
} from '@/lib/notifications/paymentWorkflow'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'
import { assertDeliveryStatusAllowed } from '@/lib/backorders'
import type { PaymentMethod } from '@prisma/client'

const invoiceWithRelations = Prisma.validator<Prisma.InvoiceDefaultArgs>()({
  include: {
    items: { orderBy: { sortOrder: 'asc' } },
    discounts: true,
    payments: { orderBy: { paidAt: 'desc' } },
    paymentArrangement: {
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    },
    // All shipments ever created for this invoice, newest first — an
    // invoice can have several (split packages, a replaced tracking
    // number, a voided label). The "primary" one for display is derived,
    // never stored — see lib/shipments/primary.ts.
    shipments: {
      include: { events: { orderBy: { eventAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    },
    activityLog: { orderBy: { createdAt: 'desc' } },
    // Every intake link ever generated for this invoice, newest first — the
    // admin UI only surfaces the most recent one, but nothing is deleted.
    intakeLinks: { orderBy: { createdAt: 'desc' } },
    // Balance Carryover (Phase 1B) — every transfer this invoice has ever
    // been the source or destination of, active or reversed. See
    // lib/balanceTransfers.ts.
    balanceTransfersOut: {
      include: { destinationInvoice: { select: { id: true, invoiceNumber: true } } },
      orderBy: { transferredAt: 'desc' },
    },
    balanceTransfersIn: {
      include: { sourceInvoice: { select: { id: true, invoiceNumber: true } } },
      orderBy: { transferredAt: 'desc' },
    },
  },
})
export type InvoiceWithRelations = Prisma.InvoiceGetPayload<typeof invoiceWithRelations>

// 'overdue' has no true per-invoice due date to check against (only
// PaymentArrangementInstallment.dueDate exists, for installment plans) — it's
// approximated as "unpaid and issued more than 30 days ago." See
// docs/Decisions.md #21.
export type InvoiceListFilter = 'all' | 'outstanding' | 'paid' | 'overdue' | 'archived'

export interface ListInvoicesParams {
  search?: string
  filter?: InvoiceListFilter
  sortBy?: 'invoiceNumber' | 'customerName' | 'createdAt' | 'balanceDue' | 'status'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

const OPEN_STATUSES: Prisma.EnumInvoiceStatusFilter = { notIn: ['CANCELLED', 'VOID'] }

function buildFilterClause(filter: InvoiceListFilter): Prisma.InvoiceWhereInput {
  switch (filter) {
    case 'archived':
      return { archivedAt: { not: null } }
    case 'outstanding':
      return { archivedAt: null, balanceDue: { gt: 0 }, status: OPEN_STATUSES }
    case 'paid':
      return { archivedAt: null, paymentStatus: 'PAID' }
    case 'overdue': {
      const cutoff = new Date()
      cutoff.setUTCDate(cutoff.getUTCDate() - 30)
      return { archivedAt: null, balanceDue: { gt: 0 }, status: OPEN_STATUSES, issuedAt: { lte: cutoff } }
    }
    case 'all':
    default:
      return { archivedAt: null }
  }
}

export async function listInvoices(params: ListInvoicesParams = {}) {
  const { search, filter = 'all', sortBy = 'createdAt', sortDir = 'desc', page = 1, limit = 25 } = params

  const searchClause: Prisma.InvoiceWhereInput = search
    ? {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          { trackingNumber: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  // A search term looks across both active and archived invoices, ignoring
  // whichever filter tab is currently selected — finding an invoice you know
  // exists shouldn't first require guessing which tab it's hiding in. Trashed
  // invoices never appear here regardless — they only live in the dedicated
  // Trash view (listTrashedInvoices).
  const where: Prisma.InvoiceWhereInput = {
    deletedAt: null,
    ...(search ? {} : buildFilterClause(filter)),
    ...searchClause,
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      ...invoiceWithRelations,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ])

  return { invoices, total, page, limit }
}

export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  return prisma.invoice.findUnique({ where: { id }, ...invoiceWithRelations })
}

interface DiscountPayloadItem {
  promotionId?: string | null
  label: string
  type: 'FIXED' | 'PERCENTAGE'
  amount: number
}

// Resolves each payload discount (which may reference a reusable Promotion)
// into a snapshot InvoiceDiscount row with its dollar amount already computed.
function buildDiscountCreateInputs(discounts: DiscountPayloadItem[], itemsTotalValue: number) {
  return discounts.map((d) => ({
    promotionId: d.promotionId ?? undefined,
    label: d.label,
    type: d.type,
    amount: d.amount,
    appliedAmount:
      d.type === 'PERCENTAGE' ? round2(itemsTotalValue * (d.amount / 100)) : round2(d.amount),
  }))
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// The Section 5 issuance guard: an invoice that still has an active
// (un-submitted, un-expired, un-invalidated) intake link attached is one
// where the admin explicitly asked the client for information that hasn't
// come back yet — issuing anyway would notify the client to pay for an
// invoice potentially missing details they were just asked for. Any other
// invoice (no intake link, or the link was already submitted/invalidated)
// issues freely.
async function assertIntakeCompletedIfRequired(invoiceId: string): Promise<void> {
  const activeLink = await prisma.intakeLink.findFirst({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
  })
  if (!activeLink) return

  const state = getIntakeLinkState(activeLink)
  if (state === 'ACTIVE' || state === 'VIEWED') {
    throw new InvoiceIssuanceError(
      'This invoice has an active intake request the client has not submitted yet. Wait for their submission, or invalidate the intake link before issuing.'
    )
  }
}

// Thrown only for the Section 5 "cannot issue yet" business-rule failures —
// distinct from Prisma/Zod errors so API routes can render a clean 400
// instead of a generic 500, same shape as z.ZodError's { error, issues }.
export class InvoiceIssuanceError extends Error {}

// Fires once, exactly at the moment an invoice first transitions into
// Issued/Pending (i.e. reaches ISSUED or PENDING for the first time) — the
// branch-aware client notification (Section 6/7) plus its SMS companion.
// Reuses the same one-time-dedup machinery as the pre-existing invoice email
// (an INVOICE_ISSUED_EMAIL_SENT activity-log row already gates re-sends), so
// re-saving an already-issued invoice never re-notifies.
async function notifyOnFirstIssuance(invoice: InvoiceWithRelations): Promise<void> {
  await sendInvoiceIssuedEmailIfNeeded(invoice)
  await sendInvoiceIssuedSmsIfNeeded(invoice)
}

export async function createInvoice(payload: InvoicePayload): Promise<InvoiceWithRelations> {
  const invoiceNumber = await generateSequentialInvoiceNumber()
  const totals = calculateInvoiceTotals(
    payload.items as InvoiceLineItemInput[],
    payload.discounts,
    payload.shippingCost,
    0
  )

  const isIssuing = payload.status === 'ISSUED'
  // A brand-new invoice can't yet have an intake link attached, so the
  // Section 5 guard never applies on create — only on an existing draft
  // (see updateInvoice) that already has one.

  const paymentAmounts = deriveInvoicePaymentAmounts(0, totals.total)
  const finalStatus = deriveInvoiceWorkflowStatus({
    currentStatus: payload.status,
    hasBeenIssued: isIssuing,
    balanceDue: paymentAmounts.balanceDue,
  })
  const paymentIntentStatus = isIssuing ? deriveInitialPaymentIntentStatus(paymentAmounts.balanceDue) : 'NOT_AVAILABLE'

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: payload.orderId || undefined,
      customerId: payload.customerId || undefined,
      customerName: payload.customerName,
      customerCompany: payload.customerCompany || undefined,
      customerEmail: payload.customerEmail || undefined,
      customerPhone: payload.customerPhone || undefined,
      billingAddress: payload.billingAddress ?? undefined,
      shippingAddress: payload.shippingAddress ?? undefined,
      internalNotes: payload.internalNotes || undefined,
      publicNotes: payload.publicNotes || undefined,
      carrier: payload.carrier ?? undefined,
      trackingNumber: payload.trackingNumber || undefined,
      shippingCost: payload.shippingCost,
      shipDate: payload.shipDate ?? undefined,
      deliveryDate: payload.deliveryDate ?? undefined,
      deliveredDate: payload.deliveredDate ?? undefined,
      deliveryStatus: payload.deliveryStatus,
      status: finalStatus,
      paymentStatus: paymentAmounts.paymentStatus,
      paymentIntentStatus,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      amountPaid: 0,
      balanceDue: paymentAmounts.balanceDue,
      overpaidAmount: paymentAmounts.overpaidAmount,
      orderStatus: computeOrderStatus(finalStatus, paymentAmounts.paymentStatus, 'NOT_SHIPPED', 'OPEN'),
      items: {
        create: payload.items.map((item, index) => ({
          productId: item.productId || undefined,
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount ?? 0,
          total: item.quantity * item.unitPrice - (item.lineDiscount ?? 0),
          sortOrder: item.sortOrder ?? index,
        })),
      },
      discounts: {
        create: buildDiscountCreateInputs(payload.discounts, totals.itemsTotal),
      },
    },
    ...invoiceWithRelations,
  })

  if (isIssuing) {
    await notifyOnFirstIssuance(invoice)
  }
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType: invoice.status === 'DRAFT' ? 'DRAFT_INVOICE_CREATED' : 'INVOICE_ISSUED',
      newValue: invoice.status,
      source: 'MANUAL',
    })
  }
  return invoice
}

export async function updateInvoice(id: string, payload: InvoicePayload): Promise<InvoiceWithRelations> {
  const existing = await prisma.invoice.findUniqueOrThrow({
    where: { id },
    include: { items: { select: { id: true } }, discounts: { select: { id: true } } },
  })

  // Only a DRAFT->ISSUED transition is a genuine first issuance — re-saving
  // an already-issued (or already-Pending, i.e. issued-with-balance)
  // invoice never re-runs the issuance guard or re-notifies, even if the
  // admin still has "Issued" selected in the dropdown.
  const wasEverIssued = existing.status !== 'DRAFT'
  const isFirstIssuance = !wasEverIssued && payload.status === 'ISSUED'

  if (isFirstIssuance) {
    await assertIntakeCompletedIfRequired(id)
  }

  // The backorder-block guard: never trusts the UI to have disabled the
  // right dropdown options — a payload that tries to move deliveryStatus to
  // SHIPPED/IN_TRANSIT/DELIVERED while an active backorder exists (and no
  // fulfillment override is on record) is rejected here, before any write.
  await assertDeliveryStatusAllowed({
    invoiceId: id,
    newDeliveryStatus: payload.deliveryStatus,
    fulfillmentOverrideAt: existing.fulfillmentOverrideAt,
  })

  const totals = calculateInvoiceTotals(
    payload.items as InvoiceLineItemInput[],
    payload.discounts,
    payload.shippingCost,
    existing.amountPaid
  )

  const paymentAmounts = deriveInvoicePaymentAmounts(existing.amountPaid, totals.total)
  const hasBeenIssued = wasEverIssued || isFirstIssuance
  // A terminal admin action (Cancelled/Refunded/Void) always wins over the
  // positive-balance overlay — deriveInvoiceWorkflowStatus only applies
  // Pending once issuance has actually happened, and never overrides a
  // terminal status regardless.
  const finalStatus = deriveInvoiceWorkflowStatus({
    currentStatus: payload.status,
    hasBeenIssued,
    balanceDue: paymentAmounts.balanceDue,
  })

  const paymentIntentStatus = isFirstIssuance
    ? deriveInitialPaymentIntentStatus(paymentAmounts.balanceDue)
    : existing.paymentIntentStatus

  const isPaidOff = paymentAmounts.paymentStatus === 'PAID'

  // Update items/discounts in place by id rather than deleting and
  // recreating everything on every save (the previous approach) — a plain
  // deleteMany+create gives every row a brand-new id on every single save,
  // which silently breaks anything that needs to reference a specific row
  // across edits (e.g. a BackorderCondition pointing at the line item it was
  // applied to, or a BackorderCompensation's linked InvoiceDiscount). An id
  // present in the payload is only honored when it matches a row that
  // actually belongs to this invoice (planRowSync never trusts a
  // client-supplied id blindly) — anything else is treated as a new row.
  const itemsWithSortOrder = payload.items.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index }))
  const itemPlan = planRowSync(existing.items, itemsWithSortOrder)
  const discountPlan = planRowSync(existing.discounts, payload.discounts)
  const discountAppliedAmount = (d: { type: 'FIXED' | 'PERCENTAGE'; amount: number }) =>
    d.type === 'PERCENTAGE' ? round2(totals.itemsTotal * (d.amount / 100)) : round2(d.amount)

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        customerName: payload.customerName,
        customerCompany: payload.customerCompany || undefined,
        customerEmail: payload.customerEmail || undefined,
        customerPhone: payload.customerPhone || undefined,
        billingAddress: payload.billingAddress ?? undefined,
        shippingAddress: payload.shippingAddress ?? undefined,
        internalNotes: payload.internalNotes || undefined,
        publicNotes: payload.publicNotes || undefined,
        carrier: payload.carrier ?? undefined,
        trackingNumber: payload.trackingNumber || undefined,
        shippingCost: payload.shippingCost,
        shipDate: payload.shipDate ?? undefined,
        deliveryDate: payload.deliveryDate ?? undefined,
        deliveredDate: payload.deliveredDate ?? undefined,
        deliveryStatus: payload.deliveryStatus,
        status: finalStatus,
        paymentStatus: paymentAmounts.paymentStatus,
        paymentIntentStatus,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        balanceDue: paymentAmounts.balanceDue,
        overpaidAmount: paymentAmounts.overpaidAmount,
        // paidAt is the auto-archive countdown's anchor (see docs/Decisions.md
        // #21), not just a historical "first paid" timestamp — it's refreshed
        // to now on every save that leaves the invoice fully paid (an edit
        // resets the countdown, per spec) and cleared the moment it no longer
        // is (reopened, balance increased, status moved off Paid), which also
        // un-archives it rather than leaving a no-longer-paid invoice hidden.
        paidAt: isPaidOff ? new Date() : null,
        archivedAt: isPaidOff ? existing.archivedAt : null,
        // Recompute here too (not just in recordPayment) so the completion
        // rule always sees whichever side (payment or shipping/edit) changed
        // most recently.
        orderStatus: computeOrderStatus(finalStatus, paymentAmounts.paymentStatus, existing.shippingStatus, existing.orderStatus),
      },
    })

    for (const { id: itemId, payload: item } of itemPlan.toUpdate) {
      await tx.invoiceItem.update({
        where: { id: itemId },
        data: {
          productId: item.productId || undefined,
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount ?? 0,
          total: item.quantity * item.unitPrice - (item.lineDiscount ?? 0),
          sortOrder: item.sortOrder,
        },
      })
    }
    if (itemPlan.toCreate.length > 0) {
      await tx.invoiceItem.createMany({
        data: itemPlan.toCreate.map((item) => ({
          invoiceId: id,
          productId: item.productId || undefined,
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount ?? 0,
          total: item.quantity * item.unitPrice - (item.lineDiscount ?? 0),
          sortOrder: item.sortOrder,
        })),
      })
    }
    if (itemPlan.toDeleteIds.length > 0) {
      await tx.invoiceItem.deleteMany({ where: { id: { in: itemPlan.toDeleteIds } } })
    }

    for (const { id: discountId, payload: d } of discountPlan.toUpdate) {
      await tx.invoiceDiscount.update({
        where: { id: discountId },
        data: {
          promotionId: d.promotionId ?? undefined,
          label: d.label,
          type: d.type,
          amount: d.amount,
          appliedAmount: discountAppliedAmount(d),
        },
      })
    }
    if (discountPlan.toCreate.length > 0) {
      await tx.invoiceDiscount.createMany({
        data: discountPlan.toCreate.map((d) => ({
          invoiceId: id,
          promotionId: d.promotionId ?? undefined,
          label: d.label,
          type: d.type,
          amount: d.amount,
          appliedAmount: discountAppliedAmount(d),
        })),
      })
    }
    if (discountPlan.toDeleteIds.length > 0) {
      await tx.invoiceDiscount.deleteMany({ where: { id: { in: discountPlan.toDeleteIds } } })
    }

    return tx.invoice.findUniqueOrThrow({ where: { id }, ...invoiceWithRelations })
  })

  if (isFirstIssuance) {
    await notifyOnFirstIssuance(invoice)
  } else if (wasEverIssued && invoice.total !== existing.total) {
    await sendInvoiceRevisedEmailIfNeeded(invoice, existing.total)
  }
  if (invoice.customerId && existing.status !== invoice.status) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType: isFirstIssuance ? 'INVOICE_ISSUED' : 'INVOICE_STATUS_UPDATED',
      previousValue: existing.status,
      newValue: invoice.status,
      source: 'MANUAL',
    })
  }
  return invoice
}

export async function recordPayment(invoiceId: string, payload: PaymentPayload): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  assertPaymentWithinBalance(payload.amount, invoice.balanceDue)

  const newAmountPaid = round2(invoice.amountPaid + payload.amount)
  const paymentAmounts = deriveInvoicePaymentAmounts(newAmountPaid, invoice.total)
  // A payment recorded during Draft never changes InvoiceStatus — Section 4
  // explicitly allows recording pre-invoice payments without forcing
  // issuance; deriveInvoiceWorkflowStatus already returns DRAFT unchanged
  // whenever hasBeenIssued is false.
  const hasBeenIssued = invoice.status !== 'DRAFT'
  const newStatus = deriveInvoiceWorkflowStatus({
    currentStatus: invoice.status,
    hasBeenIssued,
    balanceDue: paymentAmounts.balanceDue,
  })
  const newPaymentIntentStatus = resolvePaymentIntentAfterPayment(invoice.paymentIntentStatus, paymentAmounts.balanceDue)

  const payment = await prisma.invoicePayment.create({
    data: {
      invoiceId,
      amount: payload.amount,
      method: payload.method,
      referenceNumber: payload.referenceNumber || undefined,
      paidAt: payload.paidAt ?? new Date(),
      notes: payload.notes || undefined,
    },
  })

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: newAmountPaid,
      balanceDue: paymentAmounts.balanceDue,
      overpaidAmount: paymentAmounts.overpaidAmount,
      status: newStatus,
      paymentStatus: paymentAmounts.paymentStatus,
      paymentIntentStatus: newPaymentIntentStatus,
      paidAt: paymentAmounts.paymentStatus === 'PAID' ? new Date() : invoice.paidAt,
      // Payment is the other half of the "paid + delivered = completed" rule
      // (lib/tracking/orderStatus.ts) — a shipment that was already delivered
      // before the final payment landed would otherwise never recompute.
      orderStatus: computeOrderStatus(newStatus, paymentAmounts.paymentStatus, invoice.shippingStatus, invoice.orderStatus),
    },
  })

  // If this invoice has an approved payment arrangement, this payment
  // satisfies whichever installment is next in schedule order — a no-op
  // otherwise (including a REQUESTED-but-not-yet-approved arrangement,
  // which matchPaymentToNextPendingInstallment's own query excludes).
  // Done before the final fetch below so the returned invoice reflects the
  // installment's updated status, not a stale pre-match snapshot.
  await matchPaymentToNextPendingInstallment(invoiceId, payment)

  const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, ...invoiceWithRelations })
  // Only ever fires post-issuance (isInvoiceEmailTriggerStatus checks
  // ISSUED/PENDING) — a Draft-stage pre-invoice payment recorded per
  // Section 4 correctly sends nothing yet.
  await sendInvoiceIssuedEmailIfNeeded(updated)
  await sendPaymentReceivedEmailIfNeeded(updated, payment)
  if (updated.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: updated.customerId,
      invoiceId: updated.id,
      eventType: 'PAYMENT_RECEIVED',
      newValue: `$${payload.amount.toFixed(2)} via ${payload.method}`,
      source: 'MANUAL',
    })
  }
  return updated
}

// Archive rather than hard-delete, per the spec's Archive/Restore requirement.
export async function archiveInvoice(id: string): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.update({ where: { id }, data: { archivedAt: new Date() }, ...invoiceWithRelations })
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType: 'INVOICE_ARCHIVED',
      source: 'MANUAL',
    })
  }
  return invoice
}

export async function restoreInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { archivedAt: null }, ...invoiceWithRelations })
}

// Auto-archive sweep: archives every fully-paid, not-yet-archived invoice
// whose paidAt countdown has elapsed. Run daily by the Vercel Cron-triggered
// route (app/api/cron/archive-invoices) — see docs/Decisions.md #21 for why
// paidAt itself (not a separately-stored "archive on" date) is the single
// source of truth this compares against.
export async function sweepAutoArchive(archiveAfterDays: number | null): Promise<{ archivedCount: number }> {
  if (archiveAfterDays === null) return { archivedCount: 0 }

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - archiveAfterDays)

  const result = await prisma.invoice.updateMany({
    where: {
      paymentStatus: 'PAID',
      archivedAt: null,
      deletedAt: null,
      paidAt: { lte: cutoff },
    },
    data: { archivedAt: new Date() },
  })

  return { archivedCount: result.count }
}

// Soft-delete: moves an invoice into the Trash view. Recoverable via
// restoreFromTrash until someone explicitly runs permanentlyDeleteInvoice.
export async function trashInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() }, ...invoiceWithRelations })
}

export async function restoreFromTrash(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { deletedAt: null }, ...invoiceWithRelations })
}

// Lightweight fields only — the Trash list doesn't need items/discounts/
// payments, just enough to identify what's there and let the admin decide.
export async function listTrashedInvoices() {
  return prisma.invoice.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      total: true,
      status: true,
      deletedAt: true,
    },
  })
}

// Requires the invoice to already be in the trash — enforces the two-step
// "trash first, then a separate final delete" flow at the data layer, not
// just in the UI, so there's no shortcut straight to an unrecoverable delete.
export async function permanentlyDeleteInvoice(id: string): Promise<{ invoiceNumber: string }> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } })
  if (!invoice.deletedAt) {
    throw new Error('Invoice must be moved to Trash before it can be permanently deleted')
  }
  await prisma.invoice.delete({ where: { id } })
  return { invoiceNumber: invoice.invoiceNumber }
}

export async function duplicateInvoice(id: string): Promise<InvoiceWithRelations> {
  const source = await getInvoice(id)
  if (!source) throw new Error('Invoice not found')

  const invoiceNumber = await generateSequentialInvoiceNumber()

  return prisma.invoice.create({
    data: {
      invoiceNumber,
      customerName: source.customerName,
      customerCompany: source.customerCompany,
      customerEmail: source.customerEmail,
      customerPhone: source.customerPhone,
      billingAddress: source.billingAddress ?? undefined,
      shippingAddress: source.shippingAddress ?? undefined,
      carrier: source.carrier,
      shippingCost: source.shippingCost,
      deliveryStatus: 'PREPARING',
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      paymentIntentStatus: 'NOT_AVAILABLE',
      subtotal: source.subtotal,
      discountTotal: source.discountTotal,
      total: source.total,
      amountPaid: 0,
      balanceDue: source.total,
      items: {
        create: source.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount,
          total: item.total,
          sortOrder: item.sortOrder,
        })),
      },
      discounts: {
        create: source.discounts.map((d) => ({
          promotionId: d.promotionId,
          label: d.label,
          type: d.type,
          amount: d.amount,
          appliedAmount: d.appliedAmount,
        })),
      },
    },
    ...invoiceWithRelations,
  })
}

export interface InvoiceDashboardStats {
  totalInvoices: number
  paidInvoices: number
  partiallyPaidInvoices: number
  outstandingBalance: number
  pendingShipments: number
  deliveredOrders: number
  revenue: number
}

export async function getInvoiceDashboardStats(): Promise<InvoiceDashboardStats> {
  const [totalInvoices, paidInvoices, partiallyPaidInvoices, pendingShipments, deliveredOrders, activeInvoices, allInvoicesForRevenue] =
    await Promise.all([
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null } }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, paymentStatus: 'PAID' } }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, paymentStatus: 'PARTIALLY_PAID' } }),
      prisma.invoice.count({
        where: { archivedAt: null, deletedAt: null, deliveryStatus: { in: ['PREPARING', 'PACKED'] } },
      }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, deliveryStatus: 'DELIVERED' } }),
      prisma.invoice.findMany({
        where: { archivedAt: null, deletedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
        select: { balanceDue: true },
      }),
      // Revenue counts archived invoices too — an auto-archived invoice is
      // still a real, fully-paid sale, and organizing it out of the active
      // list shouldn't organize it out of revenue reporting. Trashed
      // invoices never count, though — those are "probably a mistake."
      prisma.invoice.findMany({
        where: { deletedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
        select: { total: true },
      }),
    ])

  const outstandingBalance = round2(activeInvoices.reduce((sum, i) => sum + i.balanceDue, 0))
  const revenue = round2(allInvoicesForRevenue.reduce((sum, i) => sum + i.total, 0))

  return {
    totalInvoices,
    paidInvoices,
    partiallyPaidInvoices,
    outstandingBalance,
    pendingShipments,
    deliveredOrders,
    revenue,
  }
}

// ─── Client second-submission + admin approval/denial (Sections 10-21) ───────
// Everything below is the "second client submission" the same secure intake
// link serves once an invoice is Issued/Pending with a positive balance, and
// the admin-side approval/denial that follows a payment-arrangement request.
// Business-rule error (invalid state, e.g. already resolved) throws
// InvoiceIssuanceError so callers render a clean 400; notification failures
// never do (Section 26's required sequencing: validate -> save -> commit ->
// notify, notification failure never reverses the business-state change).

function assertOpenForClientSelection(invoice: { status: string; balanceDue: number }): void {
  if (invoice.balanceDue <= 0) {
    throw new InvoiceIssuanceError('This invoice has no balance due — no payment selection is needed.')
  }
  if (invoice.status !== 'ISSUED' && invoice.status !== 'PENDING') {
    throw new InvoiceIssuanceError('This invoice is not currently open for a payment selection.')
  }
}

// Section 11 — client submits Pay in Full. Idempotent: resubmitting the
// exact same method while still awaiting confirmation is treated as a no-op
// (no duplicate notifications), matching Section 26's dedup requirement;
// selecting a *different* method still updates and re-notifies, since that's
// new information the admin needs.
export async function submitPayInFullSelection(invoiceId: string, method: PaymentMethod): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  assertOpenForClientSelection(invoice)

  const isDuplicate = invoice.paymentIntentStatus === 'AWAITING_MANUAL_CONFIRMATION' && invoice.selectedPaymentMethod === method
  if (isDuplicate) {
    return prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, ...invoiceWithRelations })
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PENDING',
      selectedPaymentMethod: method,
      paymentIntentStatus: 'AWAITING_MANUAL_CONFIRMATION',
    },
    ...invoiceWithRelations,
  })

  await logClientSubmission(updated, 'PAY_IN_FULL_SELECTED', method)
  await notifyAdminPaymentSelectionPending(updated)
  await notifyClientPaymentSelectionConfirmation(updated)

  return updated
}

// Section 15 — client submits a payment-arrangement request.
export async function submitPaymentArrangementRequest(
  invoiceId: string,
  input: RequestPaymentArrangementInput
): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  assertOpenForClientSelection(invoice)

  const arrangement = await requestPaymentArrangement(invoiceId, input)

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PENDING',
      paymentIntentStatus: 'ARRANGEMENT_APPROVAL_PENDING',
    },
    ...invoiceWithRelations,
  })

  await logClientSubmission(updated, 'ARRANGEMENT_REQUEST_SUBMITTED', `${input.frequency}, down payment $${input.proposedDownPayment.toFixed(2)}`)
  await notifyAdminArrangementRequestPending(updated, arrangement)
  await notifyClientArrangementRequestReceived(updated)

  return updated
}

// Section 18 — admin approves a REQUESTED arrangement. Invoice.status is
// never touched here (the Mandatory Positive-Balance Rule, Section 31) —
// only PaymentIntentStatus moves.
export async function approveArrangementRequest(
  invoiceId: string,
  adminUserId: string,
  overrides?: ApproveArrangementOverrides
): Promise<InvoiceWithRelations> {
  const arrangement = await approveArrangement(invoiceId, adminUserId, overrides)

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentIntentStatus: 'ARRANGEMENT_APPROVED' },
    ...invoiceWithRelations,
  })

  await logAdminDecision(updated, 'ARRANGEMENT_APPROVED', adminUserId)
  await notifyClientArrangementApproved(updated, arrangement)

  return updated
}

// Section 19 — admin denies a REQUESTED arrangement. Invoice.status stays
// exactly where it was (Pending) — client action is still required, this is
// not a cancellation.
export async function denyArrangementRequest(
  invoiceId: string,
  adminUserId: string,
  reason?: string
): Promise<InvoiceWithRelations> {
  await denyArrangement(invoiceId, adminUserId, reason)

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentIntentStatus: 'ARRANGEMENT_DENIED' },
    ...invoiceWithRelations,
  })

  await logAdminDecision(updated, 'ARRANGEMENT_DENIED', adminUserId, reason)
  await notifyClientArrangementDenied(updated, reason ?? null)

  return updated
}

async function logClientSubmission(invoice: InvoiceWithRelations, eventType: string, newValue: string): Promise<void> {
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({ customerId: invoice.customerId, invoiceId: invoice.id, eventType, newValue, source: 'MANUAL' })
  } else {
    await prisma.invoiceActivityLog.create({ data: { invoiceId: invoice.id, eventType, newValue, source: 'MANUAL' } })
  }
}

async function logAdminDecision(invoice: InvoiceWithRelations, eventType: string, adminUserId: string, note?: string): Promise<void> {
  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType,
      newValue: note ?? undefined,
      source: 'MANUAL',
      userId: adminUserId,
    })
  } else {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: invoice.id, eventType, newValue: note ?? undefined, source: 'MANUAL', userId: adminUserId },
    })
  }
}
