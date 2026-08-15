// PATCH /api/admin/invoices/[id]/backorders/[backorderId]/correct-quantity
// -- admin discrepancy correction for a BackorderCondition's recorded
// vialsBackordered snapshot. Deliberately separate from the sibling
// route's PATCH (which resolves the backorder) -- never touches
// compensation, resolution state, or any other field. See
// lib/inventory/corrections.ts's correctBackorderedQuantity.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { correctBackorderedQuantity } from '@/lib/inventory/corrections'

const schema = z.object({
  correctedVials: z.number().int().min(0),
  reason: z.string().min(1, 'A reason is required'),
})

interface RouteParams {
  params: Promise<{ id: string; backorderId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { backorderId } = await params

  try {
    const { correctedVials, reason } = schema.parse(await req.json())
    const updated = await correctBackorderedQuantity(backorderId, correctedVials, userId!, reason)
    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to correct backordered quantity'
    console.error('[admin/invoices/:id/backorders/:backorderId/correct-quantity PATCH]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
