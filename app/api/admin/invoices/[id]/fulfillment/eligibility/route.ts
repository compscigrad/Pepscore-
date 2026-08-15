// GET /api/admin/invoices/[id]/fulfillment/eligibility — drives the
// "Purchase Label" button's enable/disable state and inline explanation.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { checkFulfillmentEligibility } from '@/lib/fulfillment/gate'
import { isShippoPurchasingEnabled, SHIPPO_PURCHASING_DEFERRED_MESSAGE } from '@/lib/fulfillment/labels'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const eligibility = await checkFulfillmentEligibility(id)
  const shippoPurchasingEnabled = isShippoPurchasingEnabled()
  return NextResponse.json({
    ...eligibility,
    shippoPurchasingEnabled,
    shippoDeferredMessage: shippoPurchasingEnabled ? undefined : SHIPPO_PURCHASING_DEFERRED_MESSAGE,
  })
}
