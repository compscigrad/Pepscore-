// Customer-facing invoice reads. Every function here takes customerId as a
// required, non-optional parameter and filters by it directly in the query
// — an invoice id that doesn't belong to this customer simply doesn't
// match, so a wrong/guessed/other-customer id returns null (404), never a
// row, never even a distinguishable "exists but not yours" signal.
//
// This is a read layer only — no parallel business logic. Financial/status
// fields are the same live Invoice columns the admin portal reads; nothing
// is recomputed here.
import { prisma } from '@/lib/prisma'
import { buildPeriodDateFilter, type InvoiceHistoryPeriod } from '@/lib/invoice/historyPeriod'

// period is opt-in: omit it (as the Support page's invoice picker does) to
// get every invoice regardless of date. The Invoices page passes an
// explicit period (defaulting to the current month) for its history view.
export async function listPortalInvoices(customerId: string, period?: InvoiceHistoryPeriod) {
  return prisma.invoice.findMany({
    where: { customerId, deletedAt: null, ...buildPeriodDateFilter(period) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      paymentStatus: true,
      orderStatus: true,
      total: true,
      balanceDue: true,
      createdAt: true,
    },
  })
}

// Full detail for one invoice, ownership-checked. Returns null rather than
// throwing when the invoice doesn't exist OR doesn't belong to this
// customer — the caller treats both identically (notFound()), so a guessed
// id for another customer's invoice is indistinguishable from a bad id.
export async function getPortalInvoiceDetail(customerId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, customerId, deletedAt: null },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      discounts: true,
      // Reference-only link back to the storefront Order this invoice was
      // generated from, when one exists -- most manual invoices have none.
      order: { select: { id: true, orderNumber: true } },
      payments: { orderBy: { paidAt: 'desc' } },
      paymentArrangement: { include: { installments: { orderBy: { installmentNumber: 'asc' } } } },
      // Only fields safe for customer display are read by the page/mapper —
      // labelUrl/qrCodeUrl/providerTrackingId/providerName and admin-only
      // shipment fields are still fetched here (Prisma includes the whole
      // row) but the page component never renders them; see the explicit
      // customer-safe mapping in app/account/invoices/[id]/page.tsx.
      shipments: { where: { voidedAt: null }, orderBy: { createdAt: 'desc' } },
      backorderConditions: { orderBy: { appliedAt: 'desc' } },
      refunds: true,
      issuedAccountCredits: true,
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
}

export type PortalInvoiceDetail = NonNullable<Awaited<ReturnType<typeof getPortalInvoiceDetail>>>

// Shipment/backorder-focused view of a customer's Invoices — same rows as
// listPortalInvoices, different fields (tracking/backorder status instead
// of financial figures). Named for what it actually is: an Invoice-side
// tracking summary, NOT the storefront Order model (see lib/portal/orders.ts
// for that) -- the two are never the same record type and must not be
// presented as if they were.
export async function listPortalInvoiceTracking(customerId: string) {
  return prisma.invoice.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      orderStatus: true,
      createdAt: true,
      // Legacy self-delivery/pickup fields, read only when there are no
      // real (unvoided) Shipment rows -- see the SELF_DELIVERY bucket fix
      // in lib/fulfillment/commandCenter.ts for the admin-side counterpart
      // of this same gap.
      carrier: true,
      deliveryStatus: true,
      shipments: {
        where: { voidedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, carrier: true, trackingNumber: true, trackingUrl: true, normalizedStatus: true, estimatedDeliveryAt: true },
      },
      backorderConditions: {
        where: { status: 'ACTIVE' },
        select: { id: true, productName: true, expectedAvailableDate: true },
      },
    },
  })
}
