// GET  /api/admin/invoices/[id]/backorder-accommodation — existing
//      automatic + discretionary compensation summary, and (with
//      ?previewAmount=) the projected effect of a candidate discretionary
//      amount without writing anything.
// POST /api/admin/invoices/[id]/backorder-accommodation — apply a new
//      discretionary accommodation (lib/backorders.ts's
//      applyDiscretionaryAccommodation). Blocked if one already exists —
//      use PATCH .../[compensationId] to adjust or remove it.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  applyDiscretionaryAccommodation,
  getBackorderCompensationSummary,
  previewDiscretionaryAccommodation,
  DiscretionaryAccommodationError,
} from '@/lib/backorders'

const applySchema = z.object({
  amount: z.number().positive('Enter an amount greater than $0'),
  reason: z.string().trim().min(1, 'A reason is required'),
  preference: z.enum(['REFUND', 'ACCOUNT_CREDIT']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const previewAmountParam = req.nextUrl.searchParams.get('previewAmount')

  const summary = await getBackorderCompensationSummary(id)
  if (previewAmountParam) {
    const previewAmount = Number(previewAmountParam)
    if (!Number.isFinite(previewAmount) || previewAmount <= 0) {
      return NextResponse.json({ error: 'Invalid preview amount' }, { status: 400 })
    }
    const preview = await previewDiscretionaryAccommodation(id, previewAmount)
    return NextResponse.json({ summary, preview })
  }

  return NextResponse.json({ summary, preview: null })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = applySchema.parse(body)

    const compensation = await applyDiscretionaryAccommodation(id, {
      amount: payload.amount,
      reason: payload.reason,
      appliedBy: userId!,
      preference: payload.preference,
    })

    await prisma.adminAuditLog.create({
      data: {
        action: 'APPLY_BACKORDER_ACCOMMODATION',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { compensationId: compensation.id, amount: compensation.totalAmount, reason: payload.reason },
      },
    })

    return NextResponse.json(compensation, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof DiscretionaryAccommodationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/invoices/:id/backorder-accommodation POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to apply backorder accommodation'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
