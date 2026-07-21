// POST /api/webhooks/shippo — Shippo's track_updated webhook. Register this
// URL with Shippo (Settings -> Webhooks) as:
//   https://<your-domain>/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>
// Shippo doesn't sign webhook payloads (no HMAC secret like Stripe), so the
// shared-secret query param above is the auth boundary here — see
// lib/tracking/shippoProvider.ts's verifyWebhook and docs/Decisions.md.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shippoProvider } from '@/lib/tracking/shippoProvider'
import { processTrackingEvents } from '@/lib/tracking/service'

export async function POST(req: NextRequest) {
  const authorized = await shippoProvider.verifyWebhook(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const trackingNumber = extractTrackingNumber(payload)
  if (!trackingNumber) return NextResponse.json({ ok: true, skipped: 'no tracking number in payload' })

  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber, monitoringActive: true },
  })
  if (!shipment) {
    // Not an error — could be a webhook for a tracking number this app
    // never registered, or one that's since been removed/replaced.
    return NextResponse.json({ ok: true, skipped: 'no matching monitored shipment' })
  }

  const events = shippoProvider.normalizeWebhookPayload(payload)
  await processTrackingEvents(shipment.id, events, 'WEBHOOK')

  return NextResponse.json({ ok: true, eventsProcessed: events.length })
}

function extractTrackingNumber(payload: unknown): string | null {
  const data = payload as { data?: { tracking_number?: string }; tracking_number?: string }
  return data.data?.tracking_number ?? data.tracking_number ?? null
}
