// GET /api/admin/price-match — list requests for the review queue
// (2026-08-20 Price Match sprint). Optional ?status= filter.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listPriceMatchRequests } from '@/lib/priceMatch/requests'
import type { PriceMatchRequestStatus } from '@prisma/client'

const VALID_STATUSES = new Set(['PENDING', 'MORE_INFO_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'])

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const statusParam = req.nextUrl.searchParams.get('status')
  const status = statusParam && VALID_STATUSES.has(statusParam) ? (statusParam as PriceMatchRequestStatus) : undefined
  const search = req.nextUrl.searchParams.get('search') ?? undefined

  const requests = await listPriceMatchRequests({ status, search })
  return NextResponse.json({ requests })
}
