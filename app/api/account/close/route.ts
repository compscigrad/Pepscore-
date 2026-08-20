// POST /api/account/close -- customer-initiated account closure
// (2026-08-20). Never requires Admin approval; the only gate is a $0
// outstanding balance. Ownership is always re-derived server-side from the
// authenticated Clerk session, never trusted from client input.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPortalCustomer } from '@/lib/portalAuth'
import { closeCustomerAccount, AccountClosureBlockedError } from '@/lib/portal/accountClosure'

export async function POST() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const customer = await getPortalCustomer()
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    await closeCustomerAccount(customer.id, clerkUserId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AccountClosureBlockedError) {
      return NextResponse.json({ error: err.message, outstandingBalance: err.outstandingBalance }, { status: 409 })
    }
    console.error('[account/close POST]', err)
    return NextResponse.json({ error: 'Failed to close account' }, { status: 400 })
  }
}
