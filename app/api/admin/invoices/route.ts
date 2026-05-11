// POST /api/admin/invoices — manually create an invoice for a custom/bulk order
// GET  /api/admin/invoices — list all invoices

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { generateInvoiceNumber } from '@/lib/orders'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '25')

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            total: true,
            status: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count(),
  ])

  return NextResponse.json({ invoices, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const { orderId, notes } = await req.json()

    // Check if invoice already exists for this order
    const existing = await prisma.invoice.findUnique({ where: { orderId } })
    if (existing) {
      return NextResponse.json({ error: 'Invoice already exists for this order' }, { status: 400 })
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        orderId,
        status: 'ISSUED',
        notes: notes ?? undefined,
        issuedAt: new Date(),
      },
    })

    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_INVOICE',
        entity: 'Invoice',
        entityId: invoice.id,
        adminId: userId!,
        details: { orderId, invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json(invoice)
  } catch (err: unknown) {
    console.error('[admin/invoices]', err)
    const msg = err instanceof Error ? err.message : 'Failed to create invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { invoiceId, status, notes } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (notes !== undefined) update.notes = notes
  if (status === 'PAID') update.paidAt = new Date()

  const invoice = await prisma.invoice.update({ where: { id: invoiceId }, data: update })
  return NextResponse.json(invoice)
}
