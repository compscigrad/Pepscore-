// POST /api/admin/professional-evaluation -- Admin-initiated "Issue
// Evaluation Unit" action (Professional Sample & Evaluation Program,
// 2026-08-20). See lib/professionalEvaluation/service.ts for the full
// pricing/inventory/Finance integration.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { issueProfessionalEvaluation, ProfessionalEvaluationError } from '@/lib/professionalEvaluation/service'

const bodySchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  evaluationType: z.enum(['PAID', 'COMPLIMENTARY']),
  creditEligible: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = bodySchema.parse(await req.json())
    const evaluation = await issueProfessionalEvaluation(payload, userId!)
    return NextResponse.json({ evaluation })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProfessionalEvaluationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/professional-evaluation POST]', err)
    return NextResponse.json({ error: 'Failed to issue evaluation unit' }, { status: 400 })
  }
}
