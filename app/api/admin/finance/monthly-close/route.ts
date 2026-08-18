import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { listMonthlyCloses, updateMonthlyCloseChecklist, closeMonth, reopenMonth } from '@/lib/finance/monthlyClose'

const checklistSchema = z.object({
  ordersReconciled: z.boolean().optional(),
  paymentsReconciled: z.boolean().optional(),
  refundsReconciled: z.boolean().optional(),
  shippingReconciled: z.boolean().optional(),
  expensesEntered: z.boolean().optional(),
  receiptsReviewed: z.boolean().optional(),
  salesTaxReviewed: z.boolean().optional(),
  bankReconciled: z.boolean().optional(),
})

const postSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  action: z.enum(['UPDATE_CHECKLIST', 'CLOSE', 'REOPEN']),
  checklist: checklistSchema.optional(),
})

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  return NextResponse.json(await listMonthlyCloses(year))
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = postSchema.parse(await req.json())
    if (payload.action === 'CLOSE') {
      return NextResponse.json(await closeMonth(payload.year, payload.month, userId!))
    }
    if (payload.action === 'REOPEN') {
      return NextResponse.json(await reopenMonth(payload.year, payload.month, userId!))
    }
    return NextResponse.json(await updateMonthlyCloseChecklist(payload.year, payload.month, payload.checklist ?? {}, userId!))
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Monthly close update failed'
    console.error('[admin/finance/monthly-close POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
