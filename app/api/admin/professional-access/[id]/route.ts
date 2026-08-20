// GET   /api/admin/professional-access/[id] — application detail
// PATCH /api/admin/professional-access/[id] — { action: 'approve' | 'reject' | 'request_more_info' | 'revoke', notes? }
// 2026-08-19 Professional Access sprint, section 11.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { getProfessionalAccessApplication, reviewProfessionalAccessApplication, ProfessionalAccessApplicationError } from '@/lib/professionalAccess/applications'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const application = await getProfessionalAccessApplication(id)
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  return NextResponse.json({ application })
}

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_more_info', 'revoke']),
  notes: z.string().max(2000).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { action, notes } = patchSchema.parse(await req.json())
    const application = await reviewProfessionalAccessApplication(id, action, userId!, notes)
    return NextResponse.json({ application })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProfessionalAccessApplicationError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/professional-access/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 400 })
  }
}
