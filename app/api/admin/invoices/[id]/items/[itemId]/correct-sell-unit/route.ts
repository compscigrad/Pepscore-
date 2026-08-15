// GET/PATCH /api/admin/invoices/[id]/items/[itemId]/correct-sell-unit --
// GET feeds the confirmation dialog (current state + what's actually
// correctable); PATCH applies the correction. Never touches unitPrice,
// name, or total unless priceBehavior is explicitly RECALCULATE_PRICING
// (the historical sale snapshot is otherwise untouched). See
// lib/inventory/corrections.ts's correctInvoiceItemSellUnit.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { correctInvoiceItemSellUnit } from '@/lib/inventory/corrections'
import { getAvailableSellUnits } from '@/lib/pricing/sellUnits'

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { itemId } = await params
  const item = await prisma.invoiceItem.findUnique({ where: { id: itemId }, include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!item.productId) return NextResponse.json({ error: 'This line item has no linked catalog product' }, { status: 400 })

  const product = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } })
  const [reservation, backorder] = await Promise.all([
    prisma.inventoryReservation.findFirst({ where: { invoiceItemId: itemId, status: { in: ['ACTIVE', 'FULFILLED'] } } }),
    prisma.backorderCondition.findFirst({ where: { invoiceItemId: itemId, status: 'ACTIVE' } }),
  ])

  return NextResponse.json({
    item,
    product,
    availableSellUnits: getAvailableSellUnits(product),
    reservation,
    backorder,
  })
}

const schema = z.object({
  sellUnit: z.enum(['CASE_STANDARD', 'CASE_SPA', 'CASE_BULK', 'INDIVIDUAL_VIAL']),
  unitsPerSellUnit: z.number().int().positive(),
  individualSalesOverride: z.boolean().optional(),
  priceBehavior: z.enum(['INVENTORY_ONLY', 'RECALCULATE_PRICING']),
  newUnitPrice: z.number().nonnegative().optional(),
  reason: z.string().min(1, 'A reason is required'),
})

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { itemId } = await params

  try {
    const { sellUnit, unitsPerSellUnit, individualSalesOverride, priceBehavior, newUnitPrice, reason } = schema.parse(await req.json())
    if (priceBehavior === 'RECALCULATE_PRICING' && newUnitPrice === undefined) {
      return NextResponse.json({ error: 'newUnitPrice is required when recalculating pricing' }, { status: 400 })
    }
    const result = await correctInvoiceItemSellUnit(itemId, { sellUnit, unitsPerSellUnit, individualSalesOverride, priceBehavior, newUnitPrice }, userId!, reason)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to correct sell unit'
    console.error('[admin/invoices/:id/items/:itemId/correct-sell-unit PATCH]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
