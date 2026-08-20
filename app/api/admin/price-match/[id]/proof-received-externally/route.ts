// PATCH /api/admin/price-match/[id]/proof-received-externally -- admin
// manual override for when proof was supplied through some other legitimate
// channel (an email reply, a follow-up message) after the original
// attachment attempt FAILED or no file was ever submitted. Record-keeping
// only; never re-sends or re-validates a file (2026-08-20 Price Match
// proof-architecture closure pass).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { markPriceMatchProofReceivedExternally, PriceMatchError } from '@/lib/priceMatch/requests'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const request = await markPriceMatchProofReceivedExternally(id, userId!)
    return NextResponse.json({ request })
  } catch (err) {
    if (err instanceof PriceMatchError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/price-match/:id/proof-received-externally PATCH]', err)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 400 })
  }
}
