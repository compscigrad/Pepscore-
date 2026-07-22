// POST /api/admin/invoices/[id]/fulfillment/override — "Fulfill anyway,"
// bypassing the normal payment gate. Always attributed and permanent — see
// lib/fulfillment/gate.ts's overrideFulfillmentEligibility().
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { overrideFulfillmentEligibility } from '@/lib/fulfillment/gate'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const overrideSchema = z.object({
  note: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

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
