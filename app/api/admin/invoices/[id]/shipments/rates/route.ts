// GET /api/admin/invoices/[id]/shipments/rates?weightOz=&weightUnit=&lengthIn=&widthIn=&heightIn=
// Real-time Shippo rate shopping for the "Create Shipping Label" panel.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getShippingRatesForInvoice, FulfillmentLabelError } from '@/lib/fulfillment/labels'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const querySchema = z.object({
  weightValue: z.coerce.number().positive(),
  weightUnit: z.enum(['oz', 'lb']),
  lengthIn: z.coerce.number().positive(),
  widthIn: z.coerce.number().positive(),
  heightIn: z.coerce.number().positive(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const rates = await getShippingRatesForInvoice(
      id,
      { value: parsed.weightValue, unit: parsed.weightUnit },
      { lengthIn: parsed.lengthIn, widthIn: parsed.widthIn, heightIn: parsed.heightIn }
    )
    return NextResponse.json({ rates })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof FulfillmentLabelError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/invoices/:id/shipments/rates GET]', err)
    return NextResponse.json({ error: 'Failed to fetch shipping rates' }, { status: 500 })
  }
}
