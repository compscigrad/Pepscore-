// POST /api/admin/invoices/[id]/shipments/[shipmentId]/void — marks a
// shipment voided. Never deletes it — see lib/fulfillment/labels.ts's
// voidShipment().
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { voidShipment } from '@/lib/fulfillment/labels'

interface RouteParams {
  params: Promise<{ id: string; shipmentId: string }>
}

export async function POST(_req: Request, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { shipmentId } = await params
  await voidShipment(shipmentId, userId!)
  return NextResponse.json({ success: true })
}
