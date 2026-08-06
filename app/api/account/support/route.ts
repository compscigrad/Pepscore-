// POST /api/account/support — the portal's support-form submission.
// Rate-limited per customer (not just per IP — a customer behind a shared
// IP shouldn't be blocked by someone else's activity) to prevent spam/
// duplicate submissions.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPortalCustomer } from '@/lib/portalAuth'
import { submitSupportRequest, SupportRequestError } from '@/lib/portal/support'
import { checkRateLimit } from '@/lib/rateLimit'

const bodySchema = z.object({
  message: z.string().min(5, 'Please include a bit more detail.').max(4000),
  invoiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const customer = await getPortalCustomer()
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = checkRateLimit(`portal-support:${customer.id}`, 5, 60 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'You’ve submitted several requests recently — please wait before sending another.' }, { status: 429 })
  }

  try {
    const payload = bodySchema.parse(await req.json())
    await submitSupportRequest({ customerId: customer.id, message: payload.message, invoiceId: payload.invoiceId })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Please check the form and try again.' }, { status: 400 })
    }
    if (err instanceof SupportRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[account/support POST]', err)
    return NextResponse.json({ error: 'Failed to submit your request.' }, { status: 500 })
  }
}
