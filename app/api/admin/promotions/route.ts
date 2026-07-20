// GET  /api/admin/promotions — list reusable discount templates
// POST /api/admin/promotions — create a new reusable discount template
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { listPromotions, createPromotion } from '@/lib/promotions'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const createPromotionSchema = z.object({
  name: z.string().min(1, 'Promotion name is required'),
  description: z.string().optional(),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  amount: z.number().nonnegative('Amount cannot be negative'),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const activeOnly = req.nextUrl.searchParams.get('activeOnly') !== 'false'
  const promotions = await listPromotions(activeOnly)
  return NextResponse.json({ promotions })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = createPromotionSchema.parse(body)
    const promotion = await createPromotion(payload)
    return NextResponse.json(promotion, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/promotions POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to create promotion'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
