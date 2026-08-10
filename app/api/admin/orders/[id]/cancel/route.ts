// POST /api/admin/orders/[id]/cancel — the one safe entry point for
// cancelling a storefront Order (Phase 4A Critical #4). Never a bare
// status PATCH -- always runs cancelOrder()'s full lifecycle (idempotent,
// blocks on a succeeded payment or full fulfillment, releases only
// outstanding ACTIVE reservations, records an audit-log entry).
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cancelOrder } from '@/lib/orders/admin'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const reason: string | undefined = typeof body.reason === 'string' ? body.reason : undefined

  const result = await cancelOrder(id, userId!, reason)

  if (result.status === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (result.status === 'BLOCKED_PAID' || result.status === 'BLOCKED_FULFILLED') {
    return NextResponse.json({ error: result.reason }, { status: 409 })
  }

  return NextResponse.json(result)
}
