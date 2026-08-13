// Hard-delete eligibility for trashed invoices (2026-08-12 admin
// optimization sprint) -- permanentlyDeleteInvoice() previously only
// checked "is this already in the trash," then ran a plain
// prisma.invoice.delete(), which cascades away Payment/Refund/Shipment/
// InvoiceActivityLog/Communication rows with zero check for whether any of
// them represent real financial/fulfillment history worth keeping (see the
// admin-portal audit that found this gap). This is the one place that
// decides "is this invoice safe to erase forever," so both the API route
// and the Trash UI read the exact same answer -- never two independently
// maintained checks that could drift.
import { prisma } from '@/lib/prisma'

export type InvoiceDeletionBlockReason =
  | 'HAS_PAYMENTS'
  | 'HAS_REFUNDS'
  | 'LINKED_TO_STOREFRONT_ORDER'
  | 'HAS_SHIPMENTS'
  | 'HAS_INVENTORY_MOVEMENT'
  | 'HAS_PROMOTION_REDEMPTION'
  | 'HAS_FINANCE_RECORDS'
  | 'NOT_IN_TRASH'

export const BLOCK_REASON_LABEL: Record<InvoiceDeletionBlockReason, string> = {
  HAS_PAYMENTS: 'Has recorded payments',
  HAS_REFUNDS: 'Has refund records',
  LINKED_TO_STOREFRONT_ORDER: 'Linked to a storefront order',
  HAS_SHIPMENTS: 'Has shipment/tracking records',
  HAS_INVENTORY_MOVEMENT: 'Has inventory movement records',
  HAS_PROMOTION_REDEMPTION: 'Has a redeemed promotion code',
  HAS_FINANCE_RECORDS: 'Has linked Finance/expense records',
  NOT_IN_TRASH: 'Must be moved to Trash first',
}

export interface InvoiceDeletionEligibility {
  invoiceId: string
  invoiceNumber: string
  eligible: boolean
  blockedReasons: InvoiceDeletionBlockReason[]
}

export interface InvoiceDeletionFlags {
  isInTrash: boolean
  hasOrder: boolean
  paymentCount: number
  refundCount: number
  shipmentCount: number
  inventoryMovementCount: number
  promotionRedemptionCount: number
  financeRecordCount: number
}

// Pure decision function -- never touches Prisma, so it's unit-testable
// without a database (matches this codebase's existing split, e.g.
// lib/portal/reminderSafety.ts's planReminderBatch). The exported wrapper
// below is the only thing that actually queries the DB.
export function computeInvoiceDeletionEligibility(flags: InvoiceDeletionFlags): InvoiceDeletionBlockReason[] {
  const blockedReasons: InvoiceDeletionBlockReason[] = []
  if (!flags.isInTrash) blockedReasons.push('NOT_IN_TRASH')
  if (flags.paymentCount > 0) blockedReasons.push('HAS_PAYMENTS')
  if (flags.refundCount > 0) blockedReasons.push('HAS_REFUNDS')
  if (flags.hasOrder) blockedReasons.push('LINKED_TO_STOREFRONT_ORDER')
  if (flags.shipmentCount > 0) blockedReasons.push('HAS_SHIPMENTS')
  if (flags.inventoryMovementCount > 0) blockedReasons.push('HAS_INVENTORY_MOVEMENT')
  if (flags.promotionRedemptionCount > 0) blockedReasons.push('HAS_PROMOTION_REDEMPTION')
  if (flags.financeRecordCount > 0) blockedReasons.push('HAS_FINANCE_RECORDS')
  return blockedReasons
}

export async function getInvoiceDeletionEligibility(invoiceId: string): Promise<InvoiceDeletionEligibility> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { id: true, invoiceNumber: true, deletedAt: true, orderId: true },
  })

  const [paymentCount, refundCount, shipmentCount, inventoryMovementCount, promotionRedemptionCount, financeRecordCount] = await Promise.all([
    prisma.invoicePayment.count({ where: { invoiceId } }),
    prisma.invoiceRefund.count({ where: { invoiceId } }),
    prisma.shipment.count({ where: { invoiceId } }),
    prisma.inventoryLedgerEntry.count({ where: { invoiceId } }),
    prisma.promotionCode.count({ where: { redeemedInvoiceId: invoiceId } }),
    prisma.financeExpense.count({ where: { invoiceId } }),
  ])

  const blockedReasons = computeInvoiceDeletionEligibility({
    isInTrash: Boolean(invoice.deletedAt),
    hasOrder: Boolean(invoice.orderId),
    paymentCount,
    refundCount,
    shipmentCount,
    inventoryMovementCount,
    promotionRedemptionCount,
    financeRecordCount,
  })

  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, eligible: blockedReasons.length === 0, blockedReasons }
}

export async function getBulkInvoiceDeletionEligibility(invoiceIds: string[]): Promise<InvoiceDeletionEligibility[]> {
  return Promise.all(invoiceIds.map((id) => getInvoiceDeletionEligibility(id)))
}
