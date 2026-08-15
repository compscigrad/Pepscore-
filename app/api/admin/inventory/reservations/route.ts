// GET /api/admin/inventory/reservations -- admin lookup by invoice/
// invoice line/product/status, per the "inspect reservations by..."
// requirement. See lib/inventory/corrections.ts's findReservations.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { findReservations } from '@/lib/inventory/corrections'

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const reservations = await findReservations({
    invoiceId: searchParams.get('invoiceId') ?? undefined,
    invoiceItemId: searchParams.get('invoiceItemId') ?? undefined,
    productId: searchParams.get('productId') ?? undefined,
    status: status === 'ACTIVE' || status === 'RELEASED' || status === 'FULFILLED' ? status : undefined,
  })
  return NextResponse.json(reservations)
}
