// POST /api/admin/invoices/[id]/shipments/[shipmentId]/void — marks a
// shipment voided. Never deletes it — see lib/fulfillment/labels.ts's
// voidShipment().
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { voidShipment } from '@/lib/fulfillment/labels'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string; shipmentId: string }>
}

export async function POST(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { shipmentId } = await params
  await voidShipment(shipmentId, userId!)
  return NextResponse.json({ success: true })
}
