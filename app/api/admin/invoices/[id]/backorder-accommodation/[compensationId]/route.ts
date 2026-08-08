// PATCH /api/admin/invoices/[id]/backorder-accommodation/[compensationId]
// — adjust (action: 'adjust') or remove (action: 'remove') an existing
// discretionary accommodation. The automatic $25 policy credit is never
// editable through this route — lib/backorders.ts's
// adjustDiscretionaryAccommodation/removeDiscretionaryAccommodation both
// reject a non-DISCRETIONARY compensation.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { adjustDiscretionaryAccommodation, removeDiscretionaryAccommodation, DiscretionaryAccommodationError } from '@/lib/backorders'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('adjust'),
    newAmount: z.number().positive('Enter an amount greater than $0'),
    reason: z.string().trim().min(1, 'A reason is required'),
    preference: z.enum(['REFUND', 'ACCOUNT_CREDIT']).optional(),
  }),
  z.object({
    action: z.literal('remove'),
    reason: z.string().trim().min(1, 'A reason is required'),
  }),
])

interface RouteParams {
  params: Promise<{ id: string; compensationId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, compensationId } = await params

  try {
    const body = await req.json()
    const payload = patchSchema.parse(body)

    if (payload.action === 'adjust') {
      const compensation = await adjustDiscretionaryAccommodation(compensationId, {
        newAmount: payload.newAmount,
        reason: payload.reason,
        actor: userId!,
        preference: payload.preference,
      })
      await prisma.adminAuditLog.create({
        data: {
          action: 'ADJUST_BACKORDER_ACCOMMODATION',
          entity: 'Invoice',
          entityId: id,
          adminId: userId!,
          details: { previousCompensationId: compensationId, newCompensationId: compensation.id, newAmount: compensation.totalAmount, reason: payload.reason },
        },
      })
      return NextResponse.json(compensation)
    }

    await removeDiscretionaryAccommodation(compensationId, { actor: userId!, reason: payload.reason })
    await prisma.adminAuditLog.create({
      data: {
        action: 'REMOVE_BACKORDER_ACCOMMODATION',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { compensationId, reason: payload.reason },
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof DiscretionaryAccommodationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/invoices/:id/backorder-accommodation/:compensationId PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update backorder accommodation'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
