// Balance Carryover (Phase 1B) — moves a source invoice's remaining balance
// onto a destination invoice, via a dedicated BalanceTransfer ledger rather
// than a mutable note/total on either invoice (docs: "explicit and audited
// transfers/reversals"). Mirrors lib/backorders.ts's shape: a financial
// event gets its own function here, never routed through the general
// invoice-edit payload (updateInvoice), and Invoice.balanceDue/total/
// transferredOutAmount/carriedOverAmount are recomputed caches of this
// ledger's current ACTIVE state, never hand-edited.
import { prisma } from '@/lib/prisma'
import { deriveInvoiceWorkflowStatus, deriveInvoicePaymentAmounts } from '@/lib/invoice/status'
import { computeOrderStatus } from '@/lib/tracking/orderStatus'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'
import { archiveInvoice, getInvoice, type InvoiceWithRelations } from '@/lib/invoices'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { balanceTransferNoticeSubject, buildBalanceTransferNoticeHtml } from '@/emails/BalanceTransferNotice'
import type { Invoice, InvoiceStatus } from '@prisma/client'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Thrown for the business-rule failures this module guards against — same
// shape/intent as lib/invoices.ts's InvoiceIssuanceError and
// lib/backorders.ts's BackorderBlockedError, so API routes render a clean
// 400 instead of a generic 500.
export class BalanceTransferError extends Error {}

const TERMINAL_STATUSES: InvoiceStatus[] = ['CANCELLED', 'REFUNDED', 'VOID']

async function recordActivity(
  invoiceId: string,
  customerId: string | null,
  eventType: string,
  newValue: string,
  userId: string
): Promise<void> {
  if (customerId) {
    await syncCustomerFromInvoiceEvent({ customerId, invoiceId, eventType, newValue, source: 'MANUAL', userId })
  } else {
    await prisma.invoiceActivityLog.create({ data: { invoiceId, eventType, newValue, source: 'MANUAL', userId } })
  }
}

export interface TransferBalanceInput {
  sourceInvoiceId: string
  destinationInvoiceId: string
  amount: number
  reason?: string | null
  transferredBy: string
  // The "original-invoice disposition" the admin confirms alongside the
  // transfer itself — archiving is optional and explicit, never automatic,
  // since a source invoice might still need attention for other reasons.
  archiveSource?: boolean
}

export async function transferBalance(input: TransferBalanceInput): Promise<InvoiceWithRelations> {
  if (input.sourceInvoiceId === input.destinationInvoiceId) {
    throw new BalanceTransferError('Source and destination invoice cannot be the same invoice')
  }
  if (!(input.amount > 0)) {
    throw new BalanceTransferError('Transfer amount must be greater than zero')
  }

  const [source, destination] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: input.sourceInvoiceId } }),
    prisma.invoice.findUniqueOrThrow({ where: { id: input.destinationInvoiceId } }),
  ])

  if (source.deletedAt) throw new BalanceTransferError('Source invoice is in the trash')
  if (destination.deletedAt) throw new BalanceTransferError('Destination invoice is in the trash')
  if (TERMINAL_STATUSES.includes(source.status)) {
    throw new BalanceTransferError(`Cannot transfer a balance from a ${source.status.toLowerCase()} invoice`)
  }
  if (TERMINAL_STATUSES.includes(destination.status)) {
    throw new BalanceTransferError(`Cannot transfer a balance onto a ${destination.status.toLowerCase()} invoice`)
  }
  if (input.amount > round2(source.balanceDue) + 0.005) {
    throw new BalanceTransferError(
      `Transfer amount of $${input.amount.toFixed(2)} exceeds the source invoice's remaining balance of $${source.balanceDue.toFixed(2)}`
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.balanceTransfer.create({
      data: {
        sourceInvoiceId: source.id,
        destinationInvoiceId: destination.id,
        amount: input.amount,
        reason: input.reason || undefined,
        transferredBy: input.transferredBy,
      },
    })

    const newSourceBalanceDue = Math.max(0, round2(source.balanceDue - input.amount))
    const sourceHasBeenIssued = source.status !== 'DRAFT'
    const newSourceStatus = deriveInvoiceWorkflowStatus({
      currentStatus: source.status,
      hasBeenIssued: sourceHasBeenIssued,
      balanceDue: newSourceBalanceDue,
    })
    await tx.invoice.update({
      where: { id: source.id },
      data: {
        balanceDue: newSourceBalanceDue,
        transferredOutAmount: round2(source.transferredOutAmount + input.amount),
        status: newSourceStatus,
        orderStatus: computeOrderStatus(newSourceStatus, source.paymentStatus, source.shippingStatus, source.orderStatus),
      },
    })

    const newDestinationTotal = round2(destination.total + input.amount)
    const destinationPaymentAmounts = deriveInvoicePaymentAmounts(destination.amountPaid, newDestinationTotal)
    const destinationHasBeenIssued = destination.status !== 'DRAFT'
    const newDestinationStatus = deriveInvoiceWorkflowStatus({
      currentStatus: destination.status,
      hasBeenIssued: destinationHasBeenIssued,
      balanceDue: destinationPaymentAmounts.balanceDue,
    })
    await tx.invoice.update({
      where: { id: destination.id },
      data: {
        total: newDestinationTotal,
        carriedOverAmount: round2(destination.carriedOverAmount + input.amount),
        balanceDue: destinationPaymentAmounts.balanceDue,
        overpaidAmount: destinationPaymentAmounts.overpaidAmount,
        paymentStatus: destinationPaymentAmounts.paymentStatus,
        status: newDestinationStatus,
        orderStatus: computeOrderStatus(
          newDestinationStatus,
          destinationPaymentAmounts.paymentStatus,
          destination.shippingStatus,
          destination.orderStatus
        ),
      },
    })
  })

  await recordActivity(
    source.id,
    source.customerId,
    'BALANCE_TRANSFERRED_OUT',
    `$${input.amount.toFixed(2)} to ${destination.invoiceNumber}`,
    input.transferredBy
  )
  await recordActivity(
    destination.id,
    destination.customerId,
    'BALANCE_TRANSFERRED_IN',
    `$${input.amount.toFixed(2)} from ${source.invoiceNumber}`,
    input.transferredBy
  )

  if (input.archiveSource) {
    await archiveInvoice(source.id)
  }

  const updatedDestination = await prisma.invoice.findUniqueOrThrow({ where: { id: destination.id } })
  await sendBalanceTransferNoticeIfPossible(updatedDestination, source, input.amount)

  return (await getInvoice(destination.id)) as InvoiceWithRelations
}

async function sendBalanceTransferNoticeIfPossible(
  destination: Invoice,
  source: Invoice,
  amount: number
): Promise<void> {
  if (!destination.customerEmail) return
  await sendCategorizedEmail(
    {
      category: 'BALANCE_TRANSFER_NOTICE',
      to: destination.customerEmail,
      subject: balanceTransferNoticeSubject(destination.invoiceNumber),
      html: buildBalanceTransferNoticeHtml({
        customerName: destination.customerName,
        amount,
        sourceInvoiceNumber: source.invoiceNumber,
        destinationInvoiceNumber: destination.invoiceNumber,
        destinationBalanceDue: destination.balanceDue,
      }),
    },
    { customerId: destination.customerId, invoiceId: destination.id, actorType: 'MANUAL' }
  )
}

export interface ReverseBalanceTransferInput {
  transferId: string
  reversedBy: string
  reason?: string | null
}

export async function reverseBalanceTransfer(input: ReverseBalanceTransferInput): Promise<void> {
  const transfer = await prisma.balanceTransfer.findUniqueOrThrow({ where: { id: input.transferId } })
  if (transfer.status !== 'ACTIVE') {
    throw new BalanceTransferError('This transfer has already been reversed')
  }

  const [source, destination] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: transfer.sourceInvoiceId } }),
    prisma.invoice.findUniqueOrThrow({ where: { id: transfer.destinationInvoiceId } }),
  ])

  // Never silently rewrite history: block a reversal that would leave the
  // destination showing less total than it has already collected — that
  // would imply money was received against value that no longer exists.
  const newDestinationTotal = round2(destination.total - transfer.amount)
  if (newDestinationTotal < destination.amountPaid - 0.005) {
    throw new BalanceTransferError(
      `Cannot reverse — invoice ${destination.invoiceNumber} has already collected $${destination.amountPaid.toFixed(2)} against this balance, more than the $${newDestinationTotal.toFixed(2)} that would remain after reversing. Record a refund on the destination invoice first if the collected amount needs to move back.`
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.balanceTransfer.update({
      where: { id: transfer.id },
      data: { status: 'REVERSED', reversedAt: new Date(), reversedBy: input.reversedBy, reversalReason: input.reason || undefined },
    })

    const newSourceBalanceDue = round2(source.balanceDue + transfer.amount)
    const sourceHasBeenIssued = source.status !== 'DRAFT'
    const newSourceStatus = deriveInvoiceWorkflowStatus({
      currentStatus: source.status,
      hasBeenIssued: sourceHasBeenIssued,
      balanceDue: newSourceBalanceDue,
    })
    await tx.invoice.update({
      where: { id: source.id },
      data: {
        balanceDue: newSourceBalanceDue,
        transferredOutAmount: Math.max(0, round2(source.transferredOutAmount - transfer.amount)),
        status: newSourceStatus,
        orderStatus: computeOrderStatus(newSourceStatus, source.paymentStatus, source.shippingStatus, source.orderStatus),
      },
    })

    const destinationPaymentAmounts = deriveInvoicePaymentAmounts(destination.amountPaid, newDestinationTotal)
    const destinationHasBeenIssued = destination.status !== 'DRAFT'
    const newDestinationStatus = deriveInvoiceWorkflowStatus({
      currentStatus: destination.status,
      hasBeenIssued: destinationHasBeenIssued,
      balanceDue: destinationPaymentAmounts.balanceDue,
    })
    await tx.invoice.update({
      where: { id: destination.id },
      data: {
        total: newDestinationTotal,
        carriedOverAmount: Math.max(0, round2(destination.carriedOverAmount - transfer.amount)),
        balanceDue: destinationPaymentAmounts.balanceDue,
        overpaidAmount: destinationPaymentAmounts.overpaidAmount,
        paymentStatus: destinationPaymentAmounts.paymentStatus,
        status: newDestinationStatus,
        orderStatus: computeOrderStatus(
          newDestinationStatus,
          destinationPaymentAmounts.paymentStatus,
          destination.shippingStatus,
          destination.orderStatus
        ),
      },
    })
  })

  await recordActivity(
    source.id,
    source.customerId,
    'BALANCE_TRANSFER_REVERSED',
    `$${transfer.amount.toFixed(2)} returned from ${destination.invoiceNumber}`,
    input.reversedBy
  )
  await recordActivity(
    destination.id,
    destination.customerId,
    'BALANCE_TRANSFER_REVERSED',
    `$${transfer.amount.toFixed(2)} returned to ${source.invoiceNumber}`,
    input.reversedBy
  )
}

export async function listBalanceTransfersForInvoice(invoiceId: string) {
  const [out, incoming] = await Promise.all([
    prisma.balanceTransfer.findMany({
      where: { sourceInvoiceId: invoiceId },
      include: { destinationInvoice: { select: { id: true, invoiceNumber: true } } },
      orderBy: { transferredAt: 'desc' },
    }),
    prisma.balanceTransfer.findMany({
      where: { destinationInvoiceId: invoiceId },
      include: { sourceInvoice: { select: { id: true, invoiceNumber: true } } },
      orderBy: { transferredAt: 'desc' },
    }),
  ])
  return { out, incoming }
}
