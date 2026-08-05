// PATCH /api/admin/invoices/[id]/refunds/[refundId] — advance a pending
// refund's lifecycle. 'complete' is the only action that ever moves real
// money in the record — it requires the admin to confirm they actually
// returned it (manually, or via a future payment-provider webhook using
// this same route's underlying service function). See lib/backorders.ts.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { completeRefund, failRefund, cancelRefund } from '@/lib/backorders'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('complete'),
    completedAmount: z.number().positive().optional(),
    providerTransactionId: z.string().optional(),
  }),
  z.object({
    action: z.literal('fail'),
    failureReason: z.string().min(1, 'A failure reason is required'),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
])

interface RouteParams {
  params: Promise<{ id: string; refundId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, refundId } = await params

  try {
    const body = await req.json()
    const payload = patchSchema.parse(body)

    let refund
    if (payload.action === 'complete') {
      refund = await completeRefund(refundId, {
        completedBy: userId!,
        completedAmount: payload.completedAmount,
        providerTransactionId: payload.providerTransactionId,
      })
    } else if (payload.action === 'fail') {
      refund = await failRefund(refundId, { failedBy: userId!, failureReason: payload.failureReason })
    } else {
      refund = await cancelRefund(refundId, { cancelledBy: userId! })
    }

    await prisma.adminAuditLog.create({
      data: {
        action: `REFUND_${payload.action.toUpperCase()}`,
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { refundId: refund.id, status: refund.status },
      },
    })

    return NextResponse.json(refund)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/refunds/:refundId PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update refund'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
