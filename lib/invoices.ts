// Invoice data-access service. This is the ONLY module that queries Prisma
// for invoice data — API routes and pages call these functions, never
// `prisma.invoice.*` directly. That single seam is what lets storage move to
// something else later (per the spec's "should require minimal code changes")
// without touching any route or component.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateInvoiceTotals, type InvoiceDiscountInput, type InvoiceLineItemInput } from '@/lib/invoice/calculations'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'
import { assertPaymentWithinBalance, type InvoicePayload, type PaymentPayload } from '@/lib/invoice/validation'

const invoiceWithRelations = Prisma.validator<Prisma.InvoiceDefaultArgs>()({
  include: {
    items: { orderBy: { sortOrder: 'asc' } },
    discounts: true,
    payments: { orderBy: { paidAt: 'desc' } },
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

// Resolves each payload discount (which may reference a reusable Promotion)
// into a snapshot InvoiceDiscount row with its dollar amount already computed.
function buildDiscountCreateInputs(discounts: InvoiceDiscountInput[] & { promotionId?: string | null; label: string }[], itemsTotalValue: number) {
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
    payload.discounts as InvoiceDiscountInput[],
    payload.shippingCost,
    0
  )

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
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
        create: buildDiscountCreateInputs(payload.discounts as InvoiceDiscountInput[] & { promotionId?: string | null; label: string }[], totals.itemsTotal),
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
    payload.discounts as InvoiceDiscountInput[],
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
        create: buildDiscountCreateInputs(payload.discounts as InvoiceDiscountInput[] & { promotionId?: string | null; label: string }[], totals.itemsTotal),
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

  await prisma.invoicePayment.create({
    data: {
      invoiceId,
      amount: payload.amount,
      method: payload.method,
      referenceNumber: payload.referenceNumber || undefined,
      paidAt: payload.paidAt ?? new Date(),
      notes: payload.notes || undefined,
    },
  })

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      status: newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: newBalanceDue <= 0 ? new Date() : invoice.paidAt,
    },
    ...invoiceWithRelations,
  })
}

// Archive rather than hard-delete, per the spec's Archive/Restore requirement.
export async function archiveInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { archivedAt: new Date() }, ...invoiceWithRelations })
}

export async function restoreInvoice(id: string): Promise<InvoiceWithRelations> {
  return prisma.invoice.update({ where: { id }, data: { archivedAt: null }, ...invoiceWithRelations })
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
      prisma.invoice.count({ where: { archivedAt: null } }),
      prisma.invoice.count({ where: { archivedAt: null, status: 'PAID' } }),
      prisma.invoice.count({ where: { archivedAt: null, status: 'PARTIALLY_PAID' } }),
      prisma.invoice.count({
        where: { archivedAt: null, deliveryStatus: { in: ['PREPARING', 'PACKED'] } },
      }),
      prisma.invoice.count({ where: { archivedAt: null, deliveryStatus: 'DELIVERED' } }),
      prisma.invoice.findMany({
        where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
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
