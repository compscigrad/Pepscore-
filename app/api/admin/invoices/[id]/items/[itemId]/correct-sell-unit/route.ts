// PATCH /api/admin/invoices/[id]/items/[itemId]/correct-sell-unit -- admin
// discrepancy correction for a line item's sell unit / units-per-sell-unit
// / vial consumption. Never touches unitPrice, name, or total (the
// historical sale snapshot). See lib/inventory/corrections.ts's
// correctInvoiceItemSellUnit.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { correctInvoiceItemSellUnit } from '@/lib/inventory/corrections'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const schema = z.object({
  sellUnit: z.enum(['CASE_STANDARD', 'CASE_SPA', 'CASE_BULK', 'INDIVIDUAL_VIAL']),
  unitsPerSellUnit: z.number().int().positive(),
  inventoryQuantityConsumed: z.number().int().min(0),
  reason: z.string().min(1, 'A reason is required'),
})

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { itemId } = await params

  try {
    const { sellUnit, unitsPerSellUnit, inventoryQuantityConsumed, reason } = schema.parse(await req.json())
    const updated = await correctInvoiceItemSellUnit(itemId, { sellUnit, unitsPerSellUnit, inventoryQuantityConsumed }, userId!, reason)
    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to correct sell unit'
    console.error('[admin/invoices/:id/items/:itemId/correct-sell-unit PATCH]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
