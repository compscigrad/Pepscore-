// POST /api/account/invoices/[id]/payment-selection — the portal's Pay in
// Full submission. Ownership-checked (the invoice must belong to the
// authenticated customer), then reuses the exact same
// submitPayInFullSelection() the intake-link flow already calls — one
// implementation of "record a payment-method selection," two entry points.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getPortalCustomer } from '@/lib/portalAuth'
import { payInFullSelectionSchema } from '@/lib/invoice/validation'
import { submitPayInFullSelection, InvoiceIssuanceError } from '@/lib/invoices'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const customer = await getPortalCustomer()
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimit = checkRateLimit(`portal-payment-selection:${getClientIp(req)}`, 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment and try again.' }, { status: 429 })
  }

  const { id } = await params
  const owned = await prisma.invoice.findFirst({ where: { id, customerId: customer.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  try {
    const payload = payInFullSelectionSchema.parse(await req.json())
    const invoice = await submitPayInFullSelection(id, payload.method)
    return NextResponse.json({ ok: true, status: invoice.status, paymentIntentStatus: invoice.paymentIntentStatus })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please choose a valid payment method.', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvoiceIssuanceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[account/invoices/:id/payment-selection POST]', err)
    return NextResponse.json({ error: 'Failed to submit your payment selection.' }, { status: 500 })
  }
}
