// GET  /api/admin/invoices/[id]/backorders — list every backorder ever
//      recorded against this invoice (active and resolved), newest first
// POST /api/admin/invoices/[id]/backorders — mark a line item backordered;
//      applies/links the one-per-invoice $25 compensation automatically
//      (see lib/backorders.ts's applyBackorder)
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { applyBackorder, listBackordersForInvoice } from '@/lib/backorders'

const applyBackorderSchema = z.object({
  invoiceItemId: z.string().min(1),
  expectedAvailableDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  // Only meaningful the first time compensation is created on an invoice
  // that's already collected money — see lib/invoice/backorder.ts.
  preference: z.enum(['REFUND', 'ACCOUNT_CREDIT']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const backorders = await listBackordersForInvoice(id)
  return NextResponse.json(backorders)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = applyBackorderSchema.parse(body)

    const condition = await applyBackorder({
      invoiceId: id,
      invoiceItemId: payload.invoiceItemId,
      appliedBy: userId!,
      expectedAvailableDate: payload.expectedAvailableDate ?? null,
      notes: payload.notes ?? null,
      preference: payload.preference,
    })

    await prisma.adminAuditLog.create({
      data: {
        action: 'APPLY_BACKORDER',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { backorderConditionId: condition.id, productName: condition.productName },
      },
    })

    return NextResponse.json(condition, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/backorders POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to apply backorder'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
