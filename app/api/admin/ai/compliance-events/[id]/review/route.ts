// PATCH /api/admin/ai/compliance-events/[id]/review -- marks one
// AiComplianceEvent REVIEWED, called from the AI Control Panel's safety
// review queue (AI-1.9). Admin-only, matches
// app/api/admin/notifications/[id]/route.ts's PATCH pattern.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { markComplianceEventReviewed } from '@/lib/ai/observability/adminSummary'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(_req: Request, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const event = await markComplianceEventReviewed(id)
  return NextResponse.json(event)
}
