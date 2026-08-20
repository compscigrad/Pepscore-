// PATCH /api/admin/professional-evaluation/[id]/redeem-credit -- applies an
// AVAILABLE evaluation credit to a later qualifying full-case invoice as a
// real InvoiceDiscount. See lib/professionalEvaluation/service.ts for the
// wrong-customer/wrong-product/expired/double-redemption guards.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { redeemEvaluationCredit, ProfessionalEvaluationError } from '@/lib/professionalEvaluation/service'

interface RouteParams {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({ invoiceId: z.string().min(1) })

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { invoiceId } = bodySchema.parse(await req.json())
    const evaluation = await redeemEvaluationCredit(id, invoiceId, userId!)
    return NextResponse.json({ evaluation })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProfessionalEvaluationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/professional-evaluation/:id/redeem-credit PATCH]', err)
    return NextResponse.json({ error: 'Failed to redeem credit' }, { status: 400 })
  }
}
