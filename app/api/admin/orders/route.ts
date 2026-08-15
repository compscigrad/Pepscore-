// GET /api/admin/orders — searchable/sortable/filterable paginated order
// list for the admin "Online Storefront Orders" surface (Phase 4A Critical
// #2). PATCH /api/admin/orders — update order notes (status changes go
// through the dedicated cancel endpoint, not a bare status PATCH, so a
// cancellation always runs the real reservation-release lifecycle).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { prisma } from '@/lib/prisma'
import { listOrders, type ListOrdersParams } from '@/lib/orders/admin'
import type { OrderStatus, StorefrontPaymentMethodType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const params: ListOrdersParams = {
    search: sp.get('search') ?? undefined,
    status: (sp.get('status') as OrderStatus | 'all' | null) ?? 'all',
    paymentMethod: (sp.get('paymentMethod') as StorefrontPaymentMethodType | 'all' | null) ?? 'all',
    fulfillment: (sp.get('fulfillment') as ListOrdersParams['fulfillment']) ?? 'all',
    dateFrom: sp.get('dateFrom') ?? undefined,
    dateTo: sp.get('dateTo') ?? undefined,
    sortBy: (sp.get('sortBy') as ListOrdersParams['sortBy']) ?? 'createdAt',
    sortDir: (sp.get('sortDir') as ListOrdersParams['sortDir']) ?? 'desc',
    page: parseInt(sp.get('page') ?? '1'),
    limit: parseInt(sp.get('limit') ?? '25'),
  }

  const { orders, total, page, limit } = await listOrders(params)

  // Per-order profit metrics -- same computation the pre-existing route
  // already did, preserved here rather than dropped.
  const ordersWithProfit = orders.map((o) => {
    const cogs = o.items.reduce((s, i) => s + i.costOfGoods, 0)
    const grossProfit = o.subtotal - cogs
    const netProfit = grossProfit - o.stripeFee - o.shippingCost
    return { ...o, cogs, grossProfit, netProfit }
  })

  return NextResponse.json({ orders: ordersWithProfit, total, page, limit })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { orderId, status, notes } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  // CANCELLED must go through POST /api/admin/orders/[id]/cancel, which runs
  // the real reservation-release/payment-check lifecycle (Phase 4A Critical
  // #4) -- a bare status PATCH would silently skip all of that. Every other
  // status value (PROCESSING/SHIPPED/DELIVERED/etc.) is still a plain,
  // low-risk record-keeping update with no reservation implications.
  if (status === 'CANCELLED') {
    return NextResponse.json({ error: 'Use POST /api/admin/orders/[id]/cancel to cancel an order' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (notes !== undefined) update.notes = notes

  const order = await prisma.order.update({ where: { id: orderId }, data: update })

  await prisma.adminAuditLog.create({
    data: { action: 'UPDATE_ORDER', entity: 'Order', entityId: orderId, adminId: userId!, details: update as unknown as import('@prisma/client').Prisma.InputJsonValue },
  })

  return NextResponse.json(order)
}
