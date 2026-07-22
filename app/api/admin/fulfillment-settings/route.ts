// GET/PATCH /api/admin/fulfillment-settings — return address + package
// defaults (Settings -> Fulfillment).
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getFulfillmentSettings, updateFulfillmentSettings } from '@/lib/fulfillment/settings'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const addressSchema = z.object({
  name: z.string().min(1),
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().min(1).default('US'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
})

const patchSchema = z.object({
  returnAddress: addressSchema.optional(),
  defaultCarrier: z.enum(['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']).nullable().optional(),
  defaultService: z.string().nullable().optional(),
  defaultWeightOz: z.number().positive().nullable().optional(),
  defaultLengthIn: z.number().positive().nullable().optional(),
  defaultWidthIn: z.number().positive().nullable().optional(),
  defaultHeightIn: z.number().positive().nullable().optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const settings = await getFulfillmentSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = patchSchema.parse(body)
    const settings = await updateFulfillmentSettings(payload)
    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/fulfillment-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
