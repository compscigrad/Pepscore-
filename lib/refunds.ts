// Data access for the STANDALONE refund/account-credit workflow — the
// admin-initiated counterpart to lib/backorders.ts's applyCompensation,
// for money owed back for any reason other than a backorder (wrong item,
// customer cancellation, goodwill, etc). Builds directly on the same
// InvoiceRefund/CustomerAccountCredit models and the same lifecycle —
// PENDING/AWAITING_MANUAL_PROCESSING/PROCESSING/COMPLETED/FAILED/CANCELLED —
// as the backorder-originated flow; nothing here invents a second lifecycle.
// Completing/failing/cancelling an already-created refund still goes through
// lib/backorders.ts's completeRefund/failRefund/cancelRefund — there is
// exactly one implementation of "advance a refund's status," regardless of
// which flow created the InvoiceRefund row.
//
// Refund safety, same rule as lib/backorders.ts: requestRefund() never marks
// anything COMPLETED and never touches Invoice.amountRefunded or payment
// status — it only ever creates a PENDING obligation (or, for account
// credit, a real credit issued immediately since that's Pepscore's own
// store credit, not money moving through an external provider).
import type { InvoiceRefund, CustomerAccountCredit, PaymentMethod, RefundStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { refundRequestedSubject, buildRefundRequestedHtml, accountCreditIssuedSubject, buildAccountCreditIssuedHtml } from '@/emails/RefundNotice'
import { refundActionRequiredSubject, buildRefundActionRequiredHtml } from '@/emails/AdminBackorderAlerts'
import { allocateInvoiceDiscount, remainingRefundableForItem, remainingRefundableForInvoice, quantityRefundAmount } from '@/lib/invoice/refundAllocation'

// Non-terminal statuses still "claim" money against an invoice's paid
// total even before they complete -- a second refund request must not be
// able to over-commit against money a first, still-pending request has
// already spoken for. Only FAILED/CANCELLED release their claim.
const NON_TERMINAL_REFUND_STATUSES: RefundStatus[] = ['PENDING', 'AWAITING_MANUAL_PROCESSING', 'PROCESSING', 'COMPLETED']

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Small local duplicate of lib/backorders.ts's own private helper of the
// same name/shape — matches how formatMoney()/this exact pattern is already
// duplicated per-file elsewhere in this codebase rather than shared.
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

export interface RequestRefundInput {
  // At least one of these must be positive. Both may be set at once — the
  // "approved combination" case (part cash refund, part account credit).
  refundAmount?: number
  accountCreditAmount?: number
  reason: string
  method?: PaymentMethod
  relatedPaymentId?: string
  requestedBy: string
}

export interface RequestRefundResult {
  refund: InvoiceRefund | null
  accountCredit: CustomerAccountCredit | null
}

// The standalone creation entry point — never called by the backorder flow
// (which has its own transaction in applyCompensationTx, since a backorder's
// refund/credit is created alongside a BackorderCondition + compensation
// row atomically). This is the "admin explicitly requests a refund/credit
// for this invoice, for any reason" path.
export async function requestRefund(invoiceId: string, input: RequestRefundInput): Promise<RequestRefundResult> {
  const refundAmount = input.refundAmount ?? 0
  const accountCreditAmount = input.accountCreditAmount ?? 0
  if (refundAmount <= 0 && accountCreditAmount <= 0) {
    throw new Error('Enter a refund amount, an account credit amount, or both')
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  if (invoice.deletedAt) throw new Error('This invoice is in the trash.')
  if (accountCreditAmount > 0 && !invoice.customerId) {
    throw new Error('This invoice has no linked customer to credit — link a customer to this invoice before issuing account credit.')
  }

  const { refund, accountCredit } = await prisma.$transaction(async (tx) => {
    let createdRefund: InvoiceRefund | null = null
    let createdCredit: CustomerAccountCredit | null = null

    if (refundAmount > 0) {
      // Over-refund guard (2026-08-14) -- previously absent entirely: this
      // was the one refund-creation path with no cap at all against what
      // was actually collected. Read fresh inside the transaction so two
      // concurrent requests can't both pass the check against the same
      // stale "already refunded" figure.
      const priorClaims = await tx.invoiceRefund.findMany({
        where: { invoiceId, status: { in: NON_TERMINAL_REFUND_STATUSES } },
      })
      const pendingAmount = priorClaims
        .filter((r) => r.status !== 'COMPLETED')
        .reduce((s, r) => s + r.requestedAmount, 0)
      const invoiceBudget = remainingRefundableForInvoice(invoice.amountPaid, invoice.amountRefunded, [pendingAmount])
      if (refundAmount > invoiceBudget + 0.001) {
        throw new Error(`Refund amount ${formatMoney(refundAmount)} exceeds this invoice's remaining refundable balance of ${formatMoney(invoiceBudget)}`)
      }

      // Always created PENDING, same as the backorder path — nothing here
      // ever marks a refund COMPLETED; only completeRefund() (lib/backorders.ts,
      // an explicit, separate admin action) does that.
      createdRefund = await tx.invoiceRefund.create({
        data: {
          invoiceId,
          requestedAmount: refundAmount,
          status: 'PENDING',
          reason: input.reason,
          method: input.method ?? undefined,
          relatedPaymentId: input.relatedPaymentId ?? undefined,
          requestedAt: new Date(),
          requestedBy: input.requestedBy,
        },
      })
    }

    if (accountCreditAmount > 0) {
      // invoice.customerId is guaranteed non-null here by the guard above.
      createdCredit = await tx.customerAccountCredit.create({
        data: {
          customerId: invoice.customerId as string,
          amount: accountCreditAmount,
          remainingAmount: accountCreditAmount,
          reason: input.reason,
          sourceInvoiceId: invoiceId,
          issuedAt: new Date(),
          issuedBy: input.requestedBy,
        },
      })
    }

    return { refund: createdRefund, accountCredit: createdCredit }
  })

  if (refund) {
    await logInvoiceAndCustomerEvent(invoice, 'REFUND_REQUESTED', `${formatMoney(refund.requestedAmount)} — ${input.reason}`, input.requestedBy)
    await sendRefundRequestedEmail(invoice, refund)
    await notifyAdminRefundActionRequired(invoice, refund)
  }
  if (accountCredit) {
    await logInvoiceAndCustomerEvent(invoice, 'ACCOUNT_CREDIT_ISSUED', `${formatMoney(accountCredit.amount)} — ${input.reason}`, input.requestedBy)
    await sendAccountCreditIssuedEmail(invoice, accountCredit)
  }

  return { refund, accountCredit }
}

export interface LineItemRefundSelection {
  invoiceItemId: string
  // Omit to refund this line's full remaining refundable balance. Only
  // meaningful when the line's own quantity > 1 -- a partial-quantity
  // refund on a single-quantity line is just "refund the whole line."
  quantity?: number
}

export interface RequestLineItemRefundsInput {
  selections: LineItemRefundSelection[]
  reason: string
  method?: PaymentMethod
  requestedBy: string
}

// The item-level counterpart to requestRefund() above -- same lifecycle,
// same PENDING-only creation semantics, same completeRefund()/failRefund()/
// cancelRefund() for advancing status. One InvoiceRefund row is created
// per selected line (not one row covering all of them) so refund history
// shows a clean per-item breakdown, per the audit requirement that refund
// history make clear exactly which line(s) and how much of each. All
// rows for one admin action share one transaction, so either every
// selected line's refund is created or none are.
export async function requestLineItemRefunds(invoiceId: string, input: RequestLineItemRefundsInput): Promise<{ refunds: InvoiceRefund[] }> {
  if (input.selections.length === 0) throw new Error('Select at least one line item to refund')

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, discounts: true },
  })
  if (invoice.deletedAt) throw new Error('This invoice is in the trash.')

  // Allocation uses this invoice's own historical InvoiceItem.total and
  // InvoiceDiscount.appliedAmount snapshots -- never current catalog
  // pricing (lib/invoice/refundAllocation.ts).
  const invoiceDiscountTotal = invoice.discounts.reduce((s, d) => s + d.appliedAmount, 0)
  const allocations = allocateInvoiceDiscount(
    invoice.items.map((i) => ({ id: i.id, total: i.total, quantity: i.quantity })),
    invoiceDiscountTotal
  )
  const allocationByItemId = new Map(allocations.map((a) => [a.itemId, a]))

  const refunds = await prisma.$transaction(async (tx) => {
    const priorRefunds = await tx.invoiceRefund.findMany({
      where: { invoiceId, status: { in: NON_TERMINAL_REFUND_STATUSES } },
    })
    const priorAmountFor = (r: InvoiceRefund) => (r.status === 'COMPLETED' ? r.completedAmount ?? r.requestedAmount : r.requestedAmount)
    const priorByItemId = new Map<string, number[]>()
    let pendingInvoiceWide = 0
    for (const r of priorRefunds) {
      if (r.invoiceItemId) {
        priorByItemId.set(r.invoiceItemId, [...(priorByItemId.get(r.invoiceItemId) ?? []), priorAmountFor(r)])
      }
      if (r.status !== 'COMPLETED') pendingInvoiceWide += r.requestedAmount
    }

    let invoiceBudgetRemaining = remainingRefundableForInvoice(invoice.amountPaid, invoice.amountRefunded, [pendingInvoiceWide])
    const created: InvoiceRefund[] = []

    for (const selection of input.selections) {
      const item = invoice.items.find((i) => i.id === selection.invoiceItemId)
      if (!item) throw new Error(`Line item ${selection.invoiceItemId} does not belong to this invoice`)
      const allocation = allocationByItemId.get(item.id)
      if (!allocation) throw new Error(`Could not compute a discount allocation for ${item.name}`)

      const remainingForItem = remainingRefundableForItem(allocation.effectivePaidValue, priorByItemId.get(item.id) ?? [])

      let requestedAmount: number
      let refundedQuantity: number | undefined
      if (selection.quantity != null) {
        if (!Number.isInteger(selection.quantity) || selection.quantity <= 0 || selection.quantity > item.quantity) {
          throw new Error(`Invalid refund quantity for ${item.name} — must be between 1 and ${item.quantity}`)
        }
        requestedAmount = quantityRefundAmount(allocation.effectivePaidValue, item.quantity, selection.quantity)
        refundedQuantity = selection.quantity
      } else {
        requestedAmount = remainingForItem
      }

      if (requestedAmount <= 0) {
        throw new Error(`${item.name} has no remaining refundable balance`)
      }
      if (requestedAmount > remainingForItem + 0.001) {
        throw new Error(`Refund amount for ${item.name} exceeds its remaining refundable balance of ${formatMoney(remainingForItem)}`)
      }
      if (requestedAmount > invoiceBudgetRemaining + 0.001) {
        throw new Error(`Refunding ${item.name} would exceed this invoice's remaining refundable balance of ${formatMoney(invoiceBudgetRemaining)}`)
      }

      const refund = await tx.invoiceRefund.create({
        data: {
          invoiceId,
          invoiceItemId: item.id,
          requestedAmount,
          refundedQuantity,
          grossItemValue: allocation.grossValue,
          allocatedDiscount: allocation.allocatedDiscount,
          effectivePaidValue: allocation.effectivePaidValue,
          status: 'PENDING',
          reason: input.reason,
          method: input.method ?? undefined,
          requestedAt: new Date(),
          requestedBy: input.requestedBy,
        },
      })
      created.push(refund)
      invoiceBudgetRemaining = invoiceBudgetRemaining - requestedAmount
    }

    return created
  })

  for (const refund of refunds) {
    await logInvoiceAndCustomerEvent(invoice, 'REFUND_REQUESTED', `${formatMoney(refund.requestedAmount)} (line item) — ${input.reason}`, input.requestedBy)
    await sendRefundRequestedEmail(invoice, refund)
    await notifyAdminRefundActionRequired(invoice, refund)
  }

  return { refunds }
}

async function sendRefundRequestedEmail(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string },
  refund: InvoiceRefund
): Promise<void> {
  if (!invoice.customerEmail) return
  await sendCategorizedEmail(
    {
      category: 'REFUND_REQUESTED',
      to: invoice.customerEmail,
      subject: refundRequestedSubject(invoice.invoiceNumber),
      html: buildRefundRequestedHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        requestedAmount: refund.requestedAmount,
        reason: refund.reason,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, relatedRefundId: refund.id, actorType: 'MANUAL', actorUserId: refund.requestedBy }
  )
}

async function sendAccountCreditIssuedEmail(
  invoice: { id: string; customerId: string | null; customerEmail: string | null; customerName: string; invoiceNumber: string },
  accountCredit: CustomerAccountCredit
): Promise<void> {
  if (!invoice.customerEmail) return
  await sendCategorizedEmail(
    {
      category: 'ACCOUNT_CREDIT_ISSUED',
      to: invoice.customerEmail,
      subject: accountCreditIssuedSubject(invoice.invoiceNumber),
      html: buildAccountCreditIssuedHtml({
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        amount: accountCredit.amount,
        reason: accountCredit.reason,
      }),
    },
    { customerId: invoice.customerId, invoiceId: invoice.id, actorType: 'MANUAL', actorUserId: accountCredit.issuedBy }
  )
}

async function notifyAdminRefundActionRequired(
  invoice: { id: string; customerId: string | null; customerName: string; invoiceNumber: string },
  refund: InvoiceRefund
): Promise<void> {
  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)
  if (emailTargets.length === 0) return

  await sendCategorizedEmail(
    {
      category: 'REFUND_ACTION_REQUIRED',
      to: emailTargets.map((r) => r.email!),
      subject: refundActionRequiredSubject(invoice.invoiceNumber),
      html: buildRefundActionRequiredHtml({
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
}

export interface RefundLedgerEntry {
  kind: 'REFUND'
  id: string
  requestedAmount: number
  completedAmount: number | null
  status: InvoiceRefund['status']
  reason: string
  method: PaymentMethod | null
  providerTransactionId: string | null
  requestedAt: Date
  requestedBy: string
  completedAt: Date | null
  completedBy: string | null
  failureReason: string | null
  cancelledAt: Date | null
  cancelledBy: string | null
  origin: 'STANDALONE' | 'BACKORDER'
}

export interface AccountCreditLedgerEntry {
  kind: 'ACCOUNT_CREDIT'
  id: string
  amount: number
  remainingAmount: number
  reason: string
  issuedAt: Date
  issuedBy: string
  origin: 'STANDALONE' | 'BACKORDER'
}

// Full audit-friendly ledger for an invoice's refund detail section —
// every InvoiceRefund and CustomerAccountCredit tied to this invoice,
// regardless of whether it originated from a backorder compensation or a
// standalone admin request, newest first. Backorder-originated entries also
// still appear in BackordersSection's own compensation summary; showing them
// here too is intentional (one complete financial picture per invoice).
export async function listRefundsForInvoice(invoiceId: string): Promise<(RefundLedgerEntry | AccountCreditLedgerEntry)[]> {
  const [refunds, credits] = await Promise.all([
    prisma.invoiceRefund.findMany({
      where: { invoiceId },
      include: { backorderCompensation: true },
      orderBy: { requestedAt: 'desc' },
    }),
    prisma.customerAccountCredit.findMany({
      where: { sourceInvoiceId: invoiceId },
      include: { backorderCompensation: true },
      orderBy: { issuedAt: 'desc' },
    }),
  ])

  const refundEntries: RefundLedgerEntry[] = refunds.map((r) => ({
    kind: 'REFUND',
    id: r.id,
    requestedAmount: r.requestedAmount,
    completedAmount: r.completedAmount,
    status: r.status,
    reason: r.reason,
    method: r.method,
    providerTransactionId: r.providerTransactionId,
    requestedAt: r.requestedAt,
    requestedBy: r.requestedBy,
    completedAt: r.completedAt,
    completedBy: r.completedBy,
    failureReason: r.failureReason,
    cancelledAt: r.cancelledAt,
    cancelledBy: r.cancelledBy,
    origin: r.backorderCompensation ? 'BACKORDER' : 'STANDALONE',
  }))

  const creditEntries: AccountCreditLedgerEntry[] = credits.map((c) => ({
    kind: 'ACCOUNT_CREDIT',
    id: c.id,
    amount: c.amount,
    remainingAmount: c.remainingAmount,
    reason: c.reason,
    issuedAt: c.issuedAt,
    issuedBy: c.issuedBy,
    origin: c.backorderCompensation ? 'BACKORDER' : 'STANDALONE',
  }))

  return [...refundEntries, ...creditEntries].sort((a, b) => {
    const aDate = a.kind === 'REFUND' ? a.requestedAt : a.issuedAt
    const bDate = b.kind === 'REFUND' ? b.requestedAt : b.issuedAt
    return bDate.getTime() - aDate.getTime()
  })
}
