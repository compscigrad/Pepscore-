// GET /api/admin/customers/[id]/professional-evaluations -- Professional
// Evaluation History for the admin customer profile (Sample & Evaluation
// Program, 2026-08-20).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listCustomerProfessionalEvaluations } from '@/lib/professionalEvaluation/service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const evaluations = await listCustomerProfessionalEvaluations(id)
  return NextResponse.json({ evaluations })
}
