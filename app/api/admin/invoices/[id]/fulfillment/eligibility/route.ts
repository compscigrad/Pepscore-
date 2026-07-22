// GET /api/admin/invoices/[id]/fulfillment/eligibility — drives the
// "Purchase Label" button's enable/disable state and inline explanation.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkFulfillmentEligibility } from '@/lib/fulfillment/gate'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const eligibility = await checkFulfillmentEligibility(id)
  return NextResponse.json(eligibility)
}
