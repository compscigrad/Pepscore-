// POST /api/admin/customers/[id]/archive -- housekeeping-only, wires up
// lib/portal/accountClosure.ts's pre-existing archiveClosedCustomer()
// (built in the account-closure sprint but never had an admin route until
// now). Only reachable on an already-closed account; never reactivates
// access and never deletes anything -- purely removes clutter from active
// admin views.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { archiveClosedCustomer } from '@/lib/portal/accountClosure'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const customer = await archiveClosedCustomer(id, userId)
    return NextResponse.json(customer)
  } catch (err: unknown) {
    console.error('[admin/customers/:id/archive POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to archive customer'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
