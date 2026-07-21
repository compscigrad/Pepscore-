// GET  /api/admin/invoices — searchable/sortable/filterable invoice list (dashboard)
// POST /api/admin/invoices — create a new invoice (Stripe-linked via orderId, or fully manual)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { listInvoices, createInvoice, getInvoiceDashboardStats } from '@/lib/invoices'
import { invoicePayloadSchema } from '@/lib/invoice/validation'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const params = req.nextUrl.searchParams
  const page = parseInt(params.get('page') ?? '1')
  const limit = parseInt(params.get('limit') ?? '25')
  const search = params.get('search') ?? undefined
  const status = params.get('status') ?? undefined
  const sortBy = (params.get('sortBy') as 'invoiceNumber' | 'customerName' | 'createdAt' | 'balanceDue' | 'status') ?? 'createdAt'
  const sortDir = (params.get('sortDir') as 'asc' | 'desc') ?? 'desc'
  const includeArchived = params.get('includeArchived') === 'true'
  const withStats = params.get('withStats') === 'true'

  const [result, stats] = await Promise.all([
    listInvoices({ search, status, sortBy, sortDir, includeArchived, page, limit }),
    withStats ? getInvoiceDashboardStats() : Promise.resolve(undefined),
  ])

  return NextResponse.json({ ...result, stats })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = invoicePayloadSchema.parse(body)
    const invoice = await createInvoice(payload)

    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_INVOICE',
        entity: 'Invoice',
        entityId: invoice.id,
        adminId: userId!,
        details: { invoiceNumber: invoice.invoiceNumber, orderId: payload.orderId ?? null },
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to create invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
