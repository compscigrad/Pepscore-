// GET /api/admin/orders — paginated order list for admin dashboard
// PATCH /api/admin/orders — update order status or notes

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '25')
  const status = req.nextUrl.searchParams.get('status')

  const where = status ? { status: status as never } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        invoice: { select: { invoiceNumber: true, status: true } },
        shippingLabel: { select: { trackingNumber: true, carrier: true, labelUrl: true } },
        payments: { select: { amount: true, stripeFee: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  // Compute per-order profit metrics
  const ordersWithProfit = orders.map(o => {
    const cogs = o.items.reduce((s, i) => s + i.costOfGoods, 0)
    const grossProfit = o.subtotal - cogs
    const netProfit = grossProfit - o.stripeFee - o.shippingCost
    return { ...o, cogs, grossProfit, netProfit }
  })

  return NextResponse.json({ orders: ordersWithProfit, total, page, limit })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { orderId, status, notes } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (notes !== undefined) update.notes = notes

  const order = await prisma.order.update({ where: { id: orderId }, data: update })

  await prisma.adminAuditLog.create({
    data: {
      action: 'UPDATE_ORDER',
      entity: 'Order',
      entityId: orderId,
      adminId: userId!,
      details: update as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  })

  return NextResponse.json(order)
}
