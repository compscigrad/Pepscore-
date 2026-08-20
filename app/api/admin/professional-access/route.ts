// GET /api/admin/professional-access — list applications for the review
// queue (2026-08-19 Professional Access sprint, section 11). Optional
// ?status= filter (PENDING/APPROVED/REJECTED/MORE_INFO_REQUESTED/REVOKED).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listProfessionalAccessApplications } from '@/lib/professionalAccess/applications'
import type { ProfessionalAccessStatus } from '@prisma/client'

const VALID_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUESTED', 'REVOKED'])

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const statusParam = req.nextUrl.searchParams.get('status')
  const status = statusParam && VALID_STATUSES.has(statusParam) ? (statusParam as ProfessionalAccessStatus) : undefined
  const search = req.nextUrl.searchParams.get('search') ?? undefined

  const applications = await listProfessionalAccessApplications({ status, search })
  return NextResponse.json({ applications })
}
