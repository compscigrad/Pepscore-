// POST /api/intake/[token]/payment-arrangement — the second client
// submission (Section 15): a payment-arrangement request. Public,
// token-gated. Never approves anything — see lib/paymentArrangements.ts's
// requestPaymentArrangement, which always starts at REQUESTED.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateIntakeLink } from '@/lib/intakeLinks'
import { arrangementRequestSchema } from '@/lib/invoice/validation'
import { submitPaymentArrangementRequest, InvoiceIssuanceError } from '@/lib/invoices'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const rateLimit = checkRateLimit(`intake-arrangement-request:${getClientIp(req)}`, 20, 60_000)
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
    const payload = arrangementRequestSchema.parse(body)
    const invoice = await submitPaymentArrangementRequest(link.invoiceId, payload)
    return NextResponse.json({ ok: true, status: invoice.status, paymentIntentStatus: invoice.paymentIntentStatus })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please check the arrangement request and try again.', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvoiceIssuanceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof Error) {
      // requestPaymentArrangement's own plain-Error business-rule failures
      // (already-in-progress arrangement, down payment covers full balance,
      // etc.) — surfaced as-is, same 409 treatment as InvoiceIssuanceError.
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[intake/payment-arrangement POST]', err)
    return NextResponse.json({ error: 'Failed to submit your payment-arrangement request.' }, { status: 500 })
  }
}
