// Customer-facing storefront Order reads -- the actual Order/OrderItem/
// Payment/ShippingLabel records from checkout, distinct from Invoice
// (see docs/Decisions.md's Order/Invoice split: a manual invoice can exist
// with no Order, and a storefront Order isn't guaranteed to have a linked
// Invoice yet either). Never relabels one as the other -- an Order's own
// page always shows real Order fields; the linked Invoice, when one
// exists, is surfaced as a reference link, not merged in.
//
// Order has no direct Customer relation (only Order.userId -> User); the
// portal's ownership check is therefore userId-based, exactly like
// Customer.userId links to the same User row -- see getPortalAuthState()
// in lib/portalAuth.ts, whose returned customer.userId is what callers
// here must pass in.
import { prisma } from '@/lib/prisma'

export async function listPortalOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      fulfillmentStatus: true,
      total: true,
      createdAt: true,
      invoice: { select: { id: true, invoiceNumber: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, methodType: true, refundedAmount: true },
      },
    },
  })
}

// Ownership-checked the same way getPortalInvoiceDetail is: id AND userId
// both have to match, so a guessed/other-customer's order id returns null
// (404) rather than a row or any distinguishing signal.
export async function getPortalOrderDetail(userId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { orderBy: { id: 'asc' } },
      shippingLabel: true,
      payments: { orderBy: { createdAt: 'desc' } },
      // Discounts/backorders aren't modeled on Order itself (see schema
      // comment on Order) -- only reachable through a linked Invoice, when
      // one exists, which is why this pulls a couple of its fields rather
      // than inventing Order-level equivalents that don't exist.
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          discounts: true,
          backorderConditions: { where: { status: 'ACTIVE' }, orderBy: { appliedAt: 'desc' } },
        },
      },
    },
  })
}

export type PortalOrderDetail = NonNullable<Awaited<ReturnType<typeof getPortalOrderDetail>>>
