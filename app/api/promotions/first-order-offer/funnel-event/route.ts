// POST /api/promotions/first-order-offer/funnel-event — public,
// unauthenticated. Logs a POPUP_IMPRESSION or POPUP_DISMISSED event for the
// Admin conversion dashboard (2026-08-19 lead-capture/conversion engine,
// section 21). POPUP_SUBMITTED is deliberately NOT acceptable here -- that
// event is only ever written server-side, inside claimFirstOrderOffer()
// itself, at the moment a claim is actually recorded, so it can never be
// spoofed by a client-side call that never resulted in a real claim.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logCampaignFunnelEvent } from '@/lib/promotions/funnelEvents'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const funnelEventSchema = z.object({
  campaignId: z.string().trim().min(1),
  eventType: z.enum(['POPUP_IMPRESSION', 'POPUP_DISMISSED']),
  sourcePage: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest) {
  // Generous but real limit -- this fires on ordinary page views, not just
  // deliberate actions, so it needs more headroom than a form-submission
  // endpoint while still bounding abuse.
  const rateLimit = checkRateLimit(`popup-funnel-event:${getClientIp(req)}`, 60, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = funnelEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await logCampaignFunnelEvent(parsed.data)
  return NextResponse.json({ ok: true })
}
