// PATCH /api/account/profile — self-service profile updates. Name/phone/
// addresses/preferences apply immediately (see lib/portal/profile.ts).
// requestedEmail, if present, never touches Customer.email directly — it's
// logged and an admin is notified, since email is the identity-verification
// anchor claimPortalInvite() checks against.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPortalCustomer } from '@/lib/portalAuth'
import { updatePortalProfile, requestEmailChange } from '@/lib/portal/profile'

const addressSchema = z
  .object({
    street1: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  })
  .partial()

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  preferredContactMethod: z.enum(['SMS', 'EMAIL', 'PHONE']).optional().nullable(),
  preferredPaymentMethod: z.string().optional().nullable(),
  requestedEmail: z.string().email().optional(),
})

export async function PATCH(req: NextRequest) {
  const customer = await getPortalCustomer()
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = patchSchema.parse(await req.json())
    const { requestedEmail, ...directFields } = payload

    if (Object.keys(directFields).length > 0) {
      await updatePortalProfile(customer.id, directFields)
    }
    if (requestedEmail && requestedEmail.toLowerCase() !== (customer.email ?? '').toLowerCase()) {
      await requestEmailChange(customer.id, requestedEmail)
    }

    return NextResponse.json({ ok: true, emailChangeRequested: Boolean(requestedEmail) })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please check the form and try again.', issues: err.issues }, { status: 400 })
    }
    console.error('[account/profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }
}
