// PATCH  /api/admin/promotions/[id] — edit fields and/or toggle active
// DELETE /api/admin/promotions/[id] — permanent delete, only when unused
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { updatePromotion, deletePromotion, PromotionInUseError, DuplicatePromotionNameError } from '@/lib/promotions'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const updatePromotionSchema = z.object({
  name: z.string().min(1, 'Promotion name is required').optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  amount: z.number().nonnegative('Amount cannot be negative').optional(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const body = await req.json()
    const payload = updatePromotionSchema.parse(body)
    const promotion = await updatePromotion(id, payload)
    return NextResponse.json(promotion)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof DuplicatePromotionNameError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/promotions PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update preset'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    await deletePromotion(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof PromotionInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/promotions DELETE]', err)
    const msg = err instanceof Error ? err.message : 'Failed to delete preset'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
