// POST /api/admin/customers/[id]/close -- admin-initiated account closure
// (2026-09-03 customer lifecycle sprint). Same canonical mechanism as the
// customer's own self-service closure (lib/portal/accountClosure.ts),
// never a second/parallel closure path -- just a different entry point and
// a real admin actor for the audit trail.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { adminCloseCustomerAccount, AccountClosureBlockedError } from '@/lib/portal/accountClosure'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : undefined
    const { customer } = await adminCloseCustomerAccount(id, userId, reason)
    return NextResponse.json(customer)
  } catch (err: unknown) {
    if (err instanceof AccountClosureBlockedError) {
      return NextResponse.json({ error: err.message, outstandingBalance: err.outstandingBalance }, { status: 409 })
    }
    console.error('[admin/customers/:id/close POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to close account'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
