// GET   /api/admin/price-match/[id] — request detail
// PATCH /api/admin/price-match/[id] — review action:
//   { action: 'approve', authorizedPrice, authorizationType, expiresAt?, reviewNotes? }
//   { action: 'reject', rejectionReason, reviewNotes? }
//   { action: 'request_more_info', note }
// 2026-08-20 Price Match sprint.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import {
  getPriceMatchRequest,
  approvePriceMatchRequest,
  rejectPriceMatchRequest,
  requestMoreInfoForPriceMatchRequest,
  PriceMatchError,
} from '@/lib/priceMatch/requests'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const request = await getPriceMatchRequest(id)
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  return NextResponse.json({ request })
}

const REJECTION_REASONS = ['PRICE_ALREADY_COMPETITIVE', 'COMPETITOR_NOT_VERIFIABLE', 'PRODUCT_NOT_COMPARABLE', 'INSUFFICIENT_PROOF', 'OUTSIDE_POLICY', 'DUPLICATE_REQUEST', 'OTHER'] as const

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    authorizedPrice: z.number().positive(),
    authorizationType: z.enum(['ONE_PURCHASE', 'UNTIL_DATE', 'UNTIL_REVOKED']),
    expiresAt: z.string().datetime().optional(),
    reviewNotes: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    rejectionReason: z.enum(REJECTION_REASONS),
    reviewNotes: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal('request_more_info'),
    note: z.string().min(1).max(2000),
  }),
])

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())
    if (payload.action === 'approve') {
      const authorization = await approvePriceMatchRequest(id, userId!, {
        authorizedPrice: payload.authorizedPrice,
        authorizationType: payload.authorizationType,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        reviewNotes: payload.reviewNotes,
      })
      return NextResponse.json({ authorization })
    }
    if (payload.action === 'reject') {
      const request = await rejectPriceMatchRequest(id, userId!, payload.rejectionReason, payload.reviewNotes)
      return NextResponse.json({ request })
    }
    const request = await requestMoreInfoForPriceMatchRequest(id, userId!, payload.note)
    return NextResponse.json({ request })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof PriceMatchError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/price-match/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 400 })
  }
}
