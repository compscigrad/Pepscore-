// POST /api/webhooks/clerk
// Records Clerk login/session lifecycle events into the CustomerAccessEvent
// audit trail (lib/portal/accessEvents.ts). This route NEVER grants,
// revokes, or changes portal access itself — access is always re-derived
// live from Customer.userId/portalAccessDisabled by lib/portalAuth.ts on
// every request. Treating a webhook delivery as an access grant would let
// a replayed or forged event silently authorize someone; this route only
// ever writes audit history.
//
// Public by design (not in proxy.ts's isProtectedRoute) — same pattern as
// the Stripe and Shippo webhooks. verifyWebhook() is the entire trust
// boundary: it reads the raw body itself, so nothing here may call
// req.json()/req.text() before it, or signature verification breaks.
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { processClerkWebhookEvent, getClerkEnvironment, mapClerkEventType, extractClerkUserId } from '@/lib/portal/accessEvents'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Clerk's own delivery infrastructure is shared across many apps behind a
  // smaller set of source IPs — this caps abuse of the public URL, not
  // legitimate delivery volume. Mirrors the Stripe webhook's limit.
  const rateLimit = checkRateLimit(`clerk-webhook:${getClientIp(req)}`, 120, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const svixId = req.headers.get('svix-id')
  if (!svixId) {
    return NextResponse.json({ error: 'Missing svix-id header' }, { status: 400 })
  }

  let event
  try {
    // Verifies the svix-id/svix-timestamp/svix-signature headers against
    // CLERK_WEBHOOK_SIGNING_SECRET. Throws on missing, invalid, expired
    // (>5min skew), or tampered signatures — never trust the body before
    // this returns successfully.
    event = await verifyWebhook(req)
  } catch (err) {
    console.error('[clerk-webhook] Signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const result = await processClerkWebhookEvent(event, svixId, new Date())
    return NextResponse.json({ received: true, status: result })
  } catch (err) {
    // Processing failure is logged without exposing any secret material,
    // and recorded against the provider event id so a genuine retry (same
    // svix-id) can still succeed — nothing here throws in a way that would
    // create a duplicate timeline entry on retry, since recordAccessEvent's
    // create() either fully succeeds once or is caught as a duplicate.
    console.error('[clerk-webhook] Processing failed:', err instanceof Error ? err.message : err)
    const mappedType = mapClerkEventType(event.type)
    if (mappedType) {
      try {
        await prisma.customerAccessEvent.create({
          data: {
            providerEventId: svixId,
            clerkUserId: extractClerkUserId(event.data),
            eventType: mappedType,
            eventTimestamp: new Date(),
            environment: getClerkEnvironment(),
            processingStatus: 'FAILED',
            failureReason: err instanceof Error ? err.message.slice(0, 500) : 'Unknown processing error',
          },
        })
      } catch {
        // If even the failure-log write fails (e.g. duplicate svix-id),
        // there's nothing further to do — the original event's outcome
        // already stands.
      }
    }
    // Return 200 rather than 5xx: a processing bug on our side shouldn't
    // cause Clerk to retry indefinitely and pile up duplicate FAILED rows.
    // The failure is fully captured above for investigation.
    return NextResponse.json({ received: true, status: 'failed' })
  }
}
