// PATCH /api/account/payment-methods/[id] — set as default.
// DELETE /api/account/payment-methods/[id] — remove.
// Ownership re-derived explicitly in this route (matching every other
// app/api/account/[id]/** route's convention) before ever touching Stripe
// -- lib/payments/savedMethods.ts's own internal check is defense in
// depth, not the only gate.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPortalAuthState } from '@/lib/portalAuth'
import { setDefaultPaymentMethod, removeSavedPaymentMethod, SavedPaymentMethodError } from '@/lib/payments/savedMethods'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authState = await getPortalAuthState()
  if (authState.state !== 'AUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { customer } = authState

  const { id } = await params
  const owned = await prisma.savedPaymentMethod.findFirst({ where: { id, customerId: customer.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })

  try {
    await setDefaultPaymentMethod(id, customer.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof SavedPaymentMethodError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[account/payment-methods/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authState = await getPortalAuthState()
  if (authState.state !== 'AUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { customer } = authState

  const { id } = await params
  const owned = await prisma.savedPaymentMethod.findFirst({ where: { id, customerId: customer.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })

  try {
    await removeSavedPaymentMethod(id, customer.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof SavedPaymentMethodError) return NextResponse.json({ error: err.message }, { status: 404 })
    console.error('[account/payment-methods/:id DELETE]', err)
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 })
  }
}
