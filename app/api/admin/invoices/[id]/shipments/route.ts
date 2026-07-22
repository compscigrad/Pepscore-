// POST /api/admin/invoices/[id]/shipments — purchase a real shipping label
// (rate-shop already done via GET .../shipments/rates). Every existing
// shipment on the invoice is preserved regardless of this call's outcome —
// see lib/fulfillment/labels.ts's purchaseShippingLabelForInvoice.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { purchaseShippingLabelForInvoice, FulfillmentLabelError } from '@/lib/fulfillment/labels'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const purchaseSchema = z.object({
  rateObjectId: z.string().min(1),
  carrier: z.enum(['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']),
  service: z.string().min(1),
  weightValue: z.number().positive(),
  weightUnit: z.enum(['oz', 'lb']),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = purchaseSchema.parse(body)

    const shipment = await purchaseShippingLabelForInvoice(
      id,
      {
        rateObjectId: payload.rateObjectId,
        carrier: payload.carrier,
        service: payload.service,
        weight: { value: payload.weightValue, unit: payload.weightUnit },
        dimensions:
          payload.lengthIn && payload.widthIn && payload.heightIn
            ? { lengthIn: payload.lengthIn, widthIn: payload.widthIn, heightIn: payload.heightIn }
            : undefined,
      },
      { userId: userId! }
    )

    return NextResponse.json(shipment, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof FulfillmentLabelError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/invoices/:id/shipments POST]', err)
    return NextResponse.json({ error: 'Failed to purchase shipping label' }, { status: 500 })
  }
}
