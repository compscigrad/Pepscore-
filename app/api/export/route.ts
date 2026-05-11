// GET /api/export?year=2025&format=xlsx
// Admin-only: generates annual CPA export of all orders, expenses, and profit metrics

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { buildExportXLSX, buildExportCSV, type ExportRow } from '@/lib/export'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))
  const format = req.nextUrl.searchParams.get('format') ?? 'xlsx'

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`)

  // Fetch all paid/shipped/delivered orders for the year
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      createdAt: { gte: startDate, lt: endDate },
    },
    include: {
      items: true,
      invoice: { select: { invoiceNumber: true } },
      shippingLabel: { select: { trackingNumber: true } },
      payments: { select: { stripeFee: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Build export rows
  const rows: ExportRow[] = orders.map(o => {
    const cogs = o.items.reduce((s, i) => s + i.costOfGoods, 0)
    const grossProfit = o.subtotal - cogs
    const netProfit = grossProfit - o.stripeFee - o.shippingCost
    const itemsSummary = o.items.map(i => `${i.name} × ${i.quantity}`).join(', ')

    return {
      orderNumber: o.orderNumber,
      date: o.createdAt.toISOString().split('T')[0],
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      items: itemsSummary,
      subtotal: o.subtotal,
      shippingCost: o.shippingCost,
      stripeFee: o.stripeFee,
      tax: o.tax,
      total: o.total,
      cogs,
      grossProfit,
      netProfit,
      paymentStatus: o.status,
      fulfillmentStatus: o.fulfillmentStatus,
      trackingNumber: o.shippingLabel?.trackingNumber ?? '',
    }
  })

  if (format === 'csv') {
    const csv = buildExportCSV(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pepscore-sales-${year}.csv"`,
      },
    })
  }

  // Default: XLSX
  const buffer = buildExportXLSX(rows, year)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pepscore-sales-${year}.xlsx"`,
    },
  })
}
