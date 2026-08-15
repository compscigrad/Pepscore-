// GET /api/admin/customers/[id]/merge?loserId=... — preview: can these two
// records be safely merged, and if not, why. POST — actually perform the
// merge. The [id] in the URL is always the survivor; loserId (query param
// on GET, body field on POST) is the record being merged away and deleted.
// Never auto-merges -- an admin explicitly initiates this from the
// "Possible Duplicate" banner (Phase 4E).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { previewCustomerMerge, mergeCustomers } from '@/lib/customers/merge'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const loserId = req.nextUrl.searchParams.get('loserId')
  if (!loserId) return NextResponse.json({ error: 'loserId query param is required' }, { status: 400 })

  try {
    const preview = await previewCustomerMerge(id, loserId)
    return NextResponse.json(preview)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not preview this merge' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { loserId } = body as { loserId?: string }
  if (!loserId) return NextResponse.json({ error: 'loserId is required' }, { status: 400 })

  try {
    const result = await mergeCustomers(id, loserId, userId!)
    if (result.status === 'BLOCKED') {
      return NextResponse.json({ error: 'Cannot merge automatically', conflicts: result.conflicts }, { status: 409 })
    }
    return NextResponse.json({ ok: true, survivor: result.survivor })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to merge these customers' }, { status: 400 })
  }
}
