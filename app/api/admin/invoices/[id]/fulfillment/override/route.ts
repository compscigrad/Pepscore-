// POST /api/admin/invoices/[id]/fulfillment/override — "Fulfill anyway,"
// bypassing the normal payment gate. Always attributed and permanent — see
// lib/fulfillment/gate.ts's overrideFulfillmentEligibility().
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { overrideFulfillmentEligibility } from '@/lib/fulfillment/gate'

const overrideSchema = z.object({
  note: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { note } = overrideSchema.parse(body)
    await overrideFulfillmentEligibility(id, userId!, note)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/fulfillment/override POST]', err)
    return NextResponse.json({ error: 'Failed to override fulfillment eligibility' }, { status: 500 })
  }
}
