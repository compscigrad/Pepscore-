// Admin-facing read/write layer for storefront Orders (Phase 4A Critical #2
// + #4, Phase 4Z sales-origin clarity). "Online Storefront Orders" -- the
// customer-initiated counterpart to "Direct & Manual Sales" (Invoice).
// Mirrors lib/invoices.ts's listInvoices()/buildFilterClause() shape so the
// two admin list views feel like one product, not two independently
// invented ones.
import type { Prisma, OrderStatus, StorefrontPaymentMethodType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'

export type OrderFulfillmentFilter = 'all' | 'unfulfilled' | 'partially_fulfilled' | 'fulfilled'

export interface ListOrdersParams {
  search?: string
  status?: OrderStatus | 'all'
  paymentMethod?: StorefrontPaymentMethodType | 'all'
  fulfillment?: OrderFulfillmentFilter
  dateFrom?: string
  dateTo?: string
  sortBy?: 'orderNumber' | 'customerName' | 'createdAt' | 'total' | 'status'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Expressed as real Prisma relation filters (not derived in application
// code after the fact) so this scales the same way every other filtered
// admin list in this codebase does -- the query itself narrows the result
// set, pagination isn't trimming a client-side-filtered array.
function fulfillmentWhereClause(f: OrderFulfillmentFilter): Prisma.OrderWhereInput {
  switch (f) {
    case 'unfulfilled':
      return { AND: [{ reservations: { some: { status: 'ACTIVE' } } }, { reservations: { none: { status: 'FULFILLED' } } }] }
    case 'partially_fulfilled':
      return { AND: [{ reservations: { some: { status: 'ACTIVE' } } }, { reservations: { some: { status: 'FULFILLED' } } }] }
    case 'fulfilled':
      return { AND: [{ reservations: { some: { status: 'FULFILLED' } } }, { reservations: { none: { status: 'ACTIVE' } } }] }
    case 'all':
    default:
      return {}
  }
}

const numericSearchRegex = /^\d+(\.\d{1,2})?$/

export async function listOrders(params: ListOrdersParams = {}) {
  const {
    search,
    status = 'all',
    paymentMethod = 'all',
    fulfillment = 'all',
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    limit = 25,
  } = params

  const numericSearch = search && numericSearchRegex.test(search.trim()) ? Number(search.trim()) : null
  const searchClause: Prisma.OrderWhereInput = search
    ? {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          ...(numericSearch !== null ? [{ total: numericSearch }] : []),
        ],
      }
    : {}

  const where: Prisma.OrderWhereInput = {
    ...(status !== 'all' ? { status } : {}),
    ...(paymentMethod !== 'all' ? { payments: { some: { methodType: paymentMethod } } } : {}),
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
    ...searchClause,
    ...fulfillmentWhereClause(fulfillment),
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    sortBy === 'customerName' ? { customerName: sortDir } : sortBy === 'orderNumber' ? { orderNumber: sortDir } : sortBy === 'total' ? { total: sortDir } : sortBy === 'status' ? { status: sortDir } : { createdAt: sortDir }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
        shippingLabel: { select: { trackingNumber: true, carrier: true, labelUrl: true } },
        payments: { orderBy: { createdAt: 'desc' }, select: { status: true, methodType: true, amount: true, refundedAmount: true } },
        reservations: { select: { status: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total, page, limit }
}

export type OrderListResult = Awaited<ReturnType<typeof listOrders>>
export type OrderListRow = OrderListResult['orders'][number]

// Derived, never stored -- an order with no reservations at all (e.g.
// every item has inventory tracking disabled) reads as NONE, not
// misleadingly "fulfilled."
export type DerivedFulfillmentState = 'NONE' | 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED'

export function deriveFulfillmentState(reservations: { status: string }[]): DerivedFulfillmentState {
  if (reservations.length === 0) return 'NONE'
  const hasActive = reservations.some((r) => r.status === 'ACTIVE')
  const hasFulfilled = reservations.some((r) => r.status === 'FULFILLED')
  if (hasActive && hasFulfilled) return 'PARTIALLY_FULFILLED'
  if (hasFulfilled) return 'FULFILLED'
  if (hasActive) return 'UNFULFILLED'
  return 'NONE' // every reservation was RELEASED (e.g. a cancelled order)
}

export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true, paymentStatus: true } },
      shippingLabel: true,
      payments: { orderBy: { createdAt: 'desc' } },
      reservations: { include: { product: { select: { name: true, size: true, sku: true } } } },
      user: { select: { id: true, clerkId: true } },
    },
  })
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>

export type CancelOrderResult =
  | { status: 'CANCELLED'; alreadyCancelled: boolean }
  | { status: 'BLOCKED_PAID'; reason: string }
  | { status: 'BLOCKED_FULFILLED'; reason: string }
  | { status: 'NOT_FOUND' }

// Order cancellation lifecycle (Phase 4A Critical #4):
// - Idempotent: an already-CANCELLED order returns { alreadyCancelled: true }
//   without a second release or a second audit-log entry.
// - Unfulfilled/partially-fulfilled: releases only the still-ACTIVE
//   reservations via releaseAllOrderReservationsTx (which itself only ever
//   touches ACTIVE rows) -- already-FULFILLED reservations, and the
//   physical stock they deducted, are never touched. Real vials that
//   already shipped are never "un-shipped" by cancelling the order record.
// - Fully fulfilled: blocked outright -- cancelling an order every item of
//   which has already been fulfilled/shipped would misleadingly imply
//   inventory was restored. Direct the admin to the refund/return workflow
//   instead (see reason string).
// - Payment already succeeded: blocked outright -- this function never
//   silently cancels a paid order or invents a refund-triggering shortcut.
//   A successful payment must be refunded through the existing Stripe-side
//   process first; only then does cancellation become safe.
export async function cancelOrder(orderId: string, actor: string, reason?: string): Promise<CancelOrderResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payments: { select: { status: true } }, reservations: { select: { status: true } } },
    })
    if (!order) return { status: 'NOT_FOUND' }
    if (order.status === 'CANCELLED') return { status: 'CANCELLED', alreadyCancelled: true }

    const hasSucceededPayment = order.payments.some((p) => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')
    if (hasSucceededPayment) {
      return {
        status: 'BLOCKED_PAID',
        reason: 'This order has a successful payment on file. Refund the payment before cancelling the order.',
      }
    }

    const fulfillmentState = deriveFulfillmentState(order.reservations)
    if (fulfillmentState === 'FULFILLED') {
      return {
        status: 'BLOCKED_FULFILLED',
        reason: 'This order has already been fully fulfilled. Cancelling it would not restore shipped inventory -- use the refund/return workflow instead.',
      }
    }

    await releaseAllOrderReservationsTx(tx, orderId, actor, reason ?? 'Order cancelled by admin')
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
    await tx.adminAuditLog.create({
      data: {
        action: 'CANCEL_ORDER',
        entity: 'Order',
        entityId: orderId,
        adminId: actor,
        details: { reason: reason ?? null, priorFulfillmentState: fulfillmentState } as unknown as Prisma.InputJsonValue,
      },
    })

    return { status: 'CANCELLED', alreadyCancelled: false }
  })
}
