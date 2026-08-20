// PATCH /api/admin/price-match/authorizations/[id] — { action: 'revoke', reason? }
// Revokes a live PriceMatchAuthorization directly -- the only way an
// UNTIL_REVOKED grant ever ends, and also usable on an UNTIL_DATE grant an
// admin wants to end early. Distinct from the request-review PATCH above,
// which only ever *creates* an authorization on approval.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { revokePriceMatchAuthorization, PriceMatchError } from '@/lib/priceMatch/requests'

interface RouteParams {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({
  action: z.literal('revoke'),
  reason: z.string().max(2000).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { reason } = patchSchema.parse(await req.json())
    const authorization = await revokePriceMatchAuthorization(id, userId!, reason)
    return NextResponse.json({ authorization })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof PriceMatchError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/price-match/authorizations/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to revoke authorization' }, { status: 400 })
  }
}
