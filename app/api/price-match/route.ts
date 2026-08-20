// POST /api/price-match -- public, unauthenticated submission endpoint for
// the Price Match Guarantee request form (2026-08-20 Price Match sprint).
// See lib/priceMatch/requests.ts for the Customer-linking + review-queue
// logic; the database row this creates is the system of record, never the
// admin alert email this also sends.
import { NextRequest, NextResponse } from 'next/server'
import { priceMatchRequestSchema, isHoneypotTripped } from '@/lib/priceMatch/validation'
import { submitPriceMatchRequest, PriceMatchError } from '@/lib/priceMatch/requests'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = checkRateLimit(`price-match-submit:${ip}`, 5, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = priceMatchRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true })
  }

  try {
    await submitPriceMatchRequest({
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      productId: data.productId,
      sellUnit: data.sellUnit,
      competitorName: data.competitorName,
      competitorUrl: data.competitorUrl,
      competitorPrice: data.competitorPrice,
      competitorShippingCost: data.competitorShippingCost,
      competitorDeliveredPrice: data.competitorDeliveredPrice,
      proofUrl: data.proofUrl,
      proofNote: data.proofNote,
      customerNote: data.customerNote,
      sourcePage: data.sourcePage,
      referrer: data.referrer,
      landingUrl: data.landingUrl,
      consent: data.consent,
      ipAddress: ip,
    })
  } catch (err) {
    if (err instanceof PriceMatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
