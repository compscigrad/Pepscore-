// POST /api/intake/[token]/payment-selection — the second client submission
// (Section 11): Pay in Full. Public, token-gated, same rate-limit/validation
// shape as app/api/intake/[token]/route.ts's first submission.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateIntakeLink } from '@/lib/intakeLinks'
import { payInFullSelectionSchema } from '@/lib/invoice/validation'
import { submitPayInFullSelection, InvoiceIssuanceError } from '@/lib/invoices'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const rateLimit = checkRateLimit(`intake-payment-selection:${getClientIp(req)}`, 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment and try again.' }, { status: 429 })
  }

  const validation = await validateIntakeLink(token)
  if (!validation.valid) {
    return NextResponse.json({ error: 'This link is no longer valid.', reason: validation.reason }, { status: 410 })
  }
  const { link } = validation
  if (!link.invoiceId) {
    return NextResponse.json({ error: 'No invoice is associated with this link yet.' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const payload = payInFullSelectionSchema.parse(body)
    const invoice = await submitPayInFullSelection(link.invoiceId, payload.method)
    return NextResponse.json({ ok: true, status: invoice.status, paymentIntentStatus: invoice.paymentIntentStatus })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please choose a valid payment method.', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvoiceIssuanceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[intake/payment-selection POST]', err)
    return NextResponse.json({ error: 'Failed to submit your payment selection.' }, { status: 500 })
  }
}
