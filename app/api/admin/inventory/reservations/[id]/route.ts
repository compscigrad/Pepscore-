// POST /api/admin/inventory/reservations/[id] -- every reservation-level
// admin correction, behind one endpoint keyed by `action` (same pattern as
// /api/admin/inventory/[id]/actions). Every action requires a real Clerk
// admin userId (never a system actor) and, for anything that changes state
// rather than just querying it, an explicit `reason`.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import {
  correctReservation,
  releaseIncorrectReservation,
  restoreMissingReservation,
  reassignReservation,
  markReservationResolved,
  reverseFulfillmentDeduction,
  reapplyFulfillmentDeduction,
} from '@/lib/inventory/corrections'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CORRECT_QUANTITY'), quantity: z.number().int().min(0), reason: z.string().min(1) }),
  z.object({ action: z.literal('RELEASE'), reason: z.string().min(1) }),
  z.object({ action: z.literal('RESTORE'), reason: z.string().min(1) }),
  z.object({ action: z.literal('REASSIGN'), invoiceItemId: z.string().min(1), reason: z.string().min(1) }),
  z.object({ action: z.literal('MARK_RESOLVED'), reason: z.string().min(1) }),
  z.object({ action: z.literal('REVERSE_FULFILLMENT'), reason: z.string().min(1) }),
  z.object({ action: z.literal('REAPPLY_FULFILLMENT') }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = actionSchema.parse(await req.json())
    const actor = userId!

    let result: unknown
    switch (payload.action) {
      case 'CORRECT_QUANTITY':
        result = await correctReservation(id, payload.quantity, actor, payload.reason)
        break
      case 'RELEASE':
        result = await releaseIncorrectReservation(id, actor, payload.reason)
        break
      case 'RESTORE':
        result = await restoreMissingReservation(id, actor, payload.reason)
        break
      case 'REASSIGN':
        result = await reassignReservation(id, payload.invoiceItemId, actor, payload.reason)
        break
      case 'MARK_RESOLVED':
        result = await markReservationResolved(id, actor, payload.reason)
        break
      case 'REVERSE_FULFILLMENT':
        result = await reverseFulfillmentDeduction(id, actor, payload.reason)
        break
      case 'REAPPLY_FULFILLMENT':
        result = await reapplyFulfillmentDeduction(id, actor)
        break
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Reservation correction failed'
    console.error('[admin/inventory/reservations/:id POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
