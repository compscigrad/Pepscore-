// Invoice data-access service. This is the ONLY module that queries Prisma
// for invoice data — API routes and pages call these functions, never
// `prisma.invoice.*` directly. That single seam is what lets storage move to
// something else later (per the spec's "should require minimal code changes")
// without touching any route or component.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceLineItemInput } from '@/lib/invoice/calculations'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'
import { assertPaymentWithinBalance, type InvoicePayload, type PaymentPayload } from '@/lib/invoice/validation'
import { matchPaymentToNextPendingInstallment } from '@/lib/paymentArrangements'

const invoiceWithRelations = Prisma.validator<Prisma.InvoiceDefaultArgs>()({
  include: {
    items: { orderBy: { sortOrder: 'asc' } },
    discounts: true,
    payments: { orderBy: { paidAt: 'desc' } },
    paymentArrangement: {
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    },
  },
})
export type InvoiceWithRelations = Prisma.InvoiceGetPayload<typeof invoiceWithRelations>

export interface ListInvoicesParams {
  search?: string
  status?: string
  sortBy?: 'invoiceNumber' | 'customerName' | 'createdAt' | 'balanceDue' | 'status'
  sortDir?: 'asc' | 'desc'
  includeArchived?: boolean
  page?: number
  limit?: number
}

export async function listInvoices(params: ListInvoicesParams = {}) {
  const {
    search,
    status,
    sortBy = 'createdAt',
    sortDir = 'desc',
    includeArchived = false,
    page = 1,
    limit = 25,
  } = params

  const where: Prisma.InvoiceWhereInput = {
    // Trashed invoices never appear here, regardless of includeArchived —
    // they only live in the dedicated Trash view (listTrashedInvoices).
    deletedAt: null,
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(status ? { status: status as Prisma.EnumInvoiceStatusFilter['equals'] } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerEmail: { contains: search, mode: 'insensitive' } },
            { trackingNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
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

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export async function createInvoice(payload: InvoicePayload): Promise<InvoiceWithRelations> {
  const invoiceNumber = await generateSequentialInvoiceNumber()
  const totals = calculateInvoiceTotals(
    payload.items as InvoiceLineItemInput[],
    payload.discounts,
    payload.shippingCost,
    0
  )

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: payload.orderId || undefined,
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
      status: payload.status,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      amountPaid: 0,
      balanceDue: totals.total,
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

  return invoice
}

export async function updateInvoice(id: string, payload: InvoicePayload): Promise<InvoiceWithRelations> {
  const existing = await prisma.invoice.findUniqueOrThrow({ where: { id } })
  const totals = calculateInvoiceTotals(
    payload.items as InvoiceLineItemInput[],
    payload.discounts,
    payload.shippingCost,
    existing.amountPaid
  )

  // Replace items/discounts wholesale — simpler and safer than diffing rows,
  // and invoice edits are low-frequency admin actions, not high-throughput.
  const invoice = await prisma.invoice.update({
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
      status: payload.status,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      balanceDue: totals.balanceDue,
      paidAt: totals.balanceDue <= 0 && !existing.paidAt ? new Date() : existing.paidAt,
      items: {
        deleteMany: {},
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
        deleteMany: {},
        create: buildDiscountCreateInputs(payload.discounts, totals.itemsTotal),
      },
    },
    ...invoiceWithRelations,
  })

  return invoice
}

export async function recordPayment(invoiceId: string, payload: PaymentPayload): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  assertPaymentWithinBalance(payload.amount, invoice.balanceDue)

  const newAmountPaid = round2(invoice.amountPaid + payload.amount)
  const newBalanceDue = round2(invoice.total - newAmountPaid)

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
      balanceDue: newBalanceDue,
      status: newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: newBalanceDue <= 0 ? new Date() : invoice.paidAt,
    },
  })

  // If this invoice has a payment arrangement, this payment satisfies
  // whichever installment is next in schedule order — a no-op otherwise.
  // Done before the final fetch below so the returned invoice reflects the
  // installment's updated status, not a stale pre-match snapshot.
  await matchPaymentToNextPendingInstallment(invoiceId, payment)

  return prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, ...invoiceWithRelations })
}

// Archive rather than hard-delete, per the spec's Archive/Restore requirement.
export async function archiveInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { archivedAt: new Date() }, ...invoiceWithRelations })
}

export async function restoreInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { archivedAt: null }, ...invoiceWithRelations })
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
  const [totalInvoices, paidInvoices, partiallyPaidInvoices, pendingShipments, deliveredOrders, activeInvoices] =
    await Promise.all([
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null } }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, status: 'PAID' } }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, status: 'PARTIALLY_PAID' } }),
      prisma.invoice.count({
        where: { archivedAt: null, deletedAt: null, deliveryStatus: { in: ['PREPARING', 'PACKED'] } },
      }),
      prisma.invoice.count({ where: { archivedAt: null, deletedAt: null, deliveryStatus: 'DELIVERED' } }),
      prisma.invoice.findMany({
        where: { archivedAt: null, deletedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
        select: { total: true, balanceDue: true },
      }),
    ])

  const outstandingBalance = round2(activeInvoices.reduce((sum, i) => sum + i.balanceDue, 0))
  const revenue = round2(activeInvoices.reduce((sum, i) => sum + i.total, 0))

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
