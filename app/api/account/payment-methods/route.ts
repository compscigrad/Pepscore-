// GET /api/account/payment-methods — list the authenticated customer's
// saved methods. POST — create an embedded Stripe setup Checkout Session
// (mode: 'setup') for adding a new one.
import { NextRequest, NextResponse } from 'next/server'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listSavedPaymentMethods, createAddPaymentMethodSession } from '@/lib/payments/savedMethods'

export async function GET() {
  const authState = await getPortalAuthState()
  if (authState.state !== 'AUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const methods = await listSavedPaymentMethods(authState.customer.id)
  return NextResponse.json({ methods })
}

export async function POST(req: NextRequest) {
  const authState = await getPortalAuthState()
  if (authState.state !== 'AUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const { clientSecret } = await createAddPaymentMethodSession({
    customer: authState.customer,
    returnUrl: `${appUrl}/account/payment-methods?setup_session_id={CHECKOUT_SESSION_ID}`,
  })

  return NextResponse.json({ clientSecret })
}
