// POST /api/shipping/labels
// Admin-only: creates a Shippo shipping label for an order, saves tracking number,
// logs shipping expense, and emails the customer their tracking info.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { purchaseLabel, getRates } from '@/lib/shippo'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { buildTrackingUpdateHtml } from '@/emails/TrackingUpdate'
import type { ShippingAddress } from '@/types'

function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = carrier.toLowerCase()
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${trackingNumber}`
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`
  if (c.includes('dhl')) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`
  return `https://www.google.com/search?q=${encodeURIComponent(trackingNumber)}`
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { orderId, rateObjectId } = await req.json()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shippingLabel: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.shippingLabel) return NextResponse.json({ error: 'Label already created for this order' }, { status: 400 })

    // Purchase label from Shippo
    const label = await purchaseLabel(rateObjectId)

    // Save label + tracking to DB
    await prisma.shippingLabel.create({
      data: {
        orderId: order.id,
        carrier: label.carrier,
        service: label.servicelevel_name,
        trackingNumber: label.tracking_number,
        labelUrl: label.label_url,
        shippoLabelId: label.object_id,
        cost: parseFloat(label.rate.amount),
      },
    })

    // Update order fulfillment status and save shipping cost
    await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: 'FULFILLED',
        status: 'SHIPPED',
        shippingCost: parseFloat(label.rate.amount),
      },
    })

    // Log shipping expense for accounting
    await prisma.expense.create({
      data: {
        type: 'SHIPPING',
        amount: parseFloat(label.rate.amount),
        description: `${label.carrier} label — ${label.tracking_number}`,
        orderId: order.id,
      },
    })

    // Send tracking email to customer
    const trackingUrl = getCarrierTrackingUrl(label.carrier, label.tracking_number)
    try {
      const html = buildTrackingUpdateHtml({
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        carrier: label.carrier,
        trackingNumber: label.tracking_number,
        trackingUrl,
      })
      await resend.emails.send({
        from: FROM_EMAIL,
        to: order.customerEmail,
        subject: `Your Pepscore Order Has Shipped — ${order.orderNumber}`,
        html,
      })
    } catch (emailErr) {
      console.error('[shipping] Failed to send tracking email:', emailErr)
    }

    return NextResponse.json({
      trackingNumber: label.tracking_number,
      labelUrl: label.label_url,
      carrier: label.carrier,
      cost: parseFloat(label.rate.amount),
    })
  } catch (err: unknown) {
    console.error('[shipping/labels]', err)
    const msg = err instanceof Error ? err.message : 'Failed to create label'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/shipping/labels/rates?orderId=xxx
// Returns Shippo rates for an order's destination address
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const addr = order.shippingAddress as unknown as ShippingAddress

  const addressFrom = {
    name: process.env.SHIP_FROM_NAME ?? 'Pepscore Research',
    street1: process.env.SHIP_FROM_STREET ?? '',
    city: process.env.SHIP_FROM_CITY ?? '',
    state: process.env.SHIP_FROM_STATE ?? '',
    zip: process.env.SHIP_FROM_ZIP ?? '',
    country: process.env.SHIP_FROM_COUNTRY ?? 'US',
    phone: process.env.SHIP_FROM_PHONE ?? '',
  }

  const addressTo = {
    name: addr.name,
    street1: addr.street1,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
    phone: addr.phone,
  }

  // Standard parcel dimensions for peptide vials
  const parcel = {
    length: '6',
    width: '4',
    height: '3',
    distance_unit: 'in' as const,
    weight: '0.5',
    mass_unit: 'lb' as const,
  }

  const rates = await getRates(addressFrom, addressTo, parcel)
  return NextResponse.json({ rates })
}
