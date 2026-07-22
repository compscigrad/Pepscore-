// POST   /api/admin/invoices/[id]/tracking — add/replace tracking (full workflow)
// PATCH  /api/admin/invoices/[id]/tracking — admin actions: refresh | mark-delivered | override-status | resend-notification
// DELETE /api/admin/invoices/[id]/tracking — remove tracking (stop monitoring)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  addTrackingToInvoice,
  refreshShipmentTracking,
  markDeliveredManually,
  overrideShippingStatus,
  removeTracking,
} from '@/lib/tracking/service'
import { resendLastNotification } from '@/lib/tracking/notifications'
import { getPrimaryShipment } from '@/lib/shipments/primary'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const addTrackingSchema = z.object({
  carrier: z.enum(['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']),
  trackingNumber: z.string().min(1),
  service: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = addTrackingSchema.parse(body)

    const result = await addTrackingToInvoice(
      id,
      { carrier: payload.carrier, trackingNumber: payload.trackingNumber, service: payload.service },
      { source: 'MANUAL', userId: userId! }
    )

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/tracking POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to add tracking'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const patchSchema = z.object({
  action: z.enum(['refresh', 'mark-delivered', 'override-status', 'resend-notification']),
  status: z
    .enum([
      'NOT_SHIPPED',
      'TRACKING_ADDED',
      'LABEL_CREATED',
      'CARRIER_AWAITING_PACKAGE',
      'ACCEPTED_BY_CARRIER',
      'IN_TRANSIT',
      'DELAYED',
      'DELIVERY_EXCEPTION',
      'AVAILABLE_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RETURNED_TO_SENDER',
      'DELIVERY_ATTEMPTED',
      'LOST',
      'CANCELLED',
      'UNKNOWN',
    ])
    .optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const { action, status } = patchSchema.parse(body)

    switch (action) {
      case 'refresh': {
        const shipments = await prisma.shipment.findMany({ where: { invoiceId: id } })
        const shipment = getPrimaryShipment(shipments)
        if (!shipment) return NextResponse.json({ error: 'No tracking on this invoice' }, { status: 400 })
        await refreshShipmentTracking(shipment.id, 'MANUAL')
        break
      }
      case 'mark-delivered':
        await markDeliveredManually(id, userId!)
        break
      case 'override-status':
        if (!status) return NextResponse.json({ error: 'status is required for override-status' }, { status: 400 })
        await overrideShippingStatus(id, status, userId!)
        break
      case 'resend-notification':
        await resendLastNotification(id)
        break
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { shipments: { orderBy: { createdAt: 'desc' } } },
    })
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/tracking PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update tracking'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    await removeTracking(id, userId!)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[admin/invoices/:id/tracking DELETE]', err)
    const msg = err instanceof Error ? err.message : 'Failed to remove tracking'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
