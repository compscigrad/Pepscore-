// GET /api/cron/release-abandoned-reservations — scheduled reconciliation
// backstop for abandoned/expired storefront checkouts (Phase 4A Critical
// #3). The checkout.session.expired webhook handler
// (app/api/webhooks/stripe/route.ts) is the primary release path; this
// cron exists for whatever it misses -- a webhook that never arrives, a
// delivery that fails past Stripe's own retry window, or an app outage
// during the delivery window.
//
// Aligns with Stripe's own authoritative session expiry rather than
// inventing a conflicting timer: an embedded Checkout Session defaults to
// expiring 24h after creation. RESERVATION_HOLD_HOURS adds a 1h buffer so
// this never races ahead of a session Stripe itself still considers open.
//
// Idempotent by construction: only ever selects orders still genuinely
// PENDING with an ACTIVE reservation -- an order this cron (or the
// webhook) already released moves to CANCELLED and drops out of every
// future run's candidate set on its own, no separate "already processed"
// bookkeeping needed. Belt-and-suspenders: before releasing, re-checks the
// real Stripe session status directly (not just local DB state) and skips
// (never releases) any session Stripe itself reports as 'complete' --
// that order is left for the webhook path to reconcile instead of racing
// against a payment that may have actually succeeded.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { markOrderPaymentFailedOrReturned } from '@/lib/payments/orderFulfillment'
import { safeCompare } from '@/lib/security/safeCompare'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  return provided !== null && safeCompare(provided, `Bearer ${secret}`)
}

const RESERVATION_HOLD_HOURS = 25
const MAX_ORDERS_PER_RUN = 100

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RESERVATION_HOLD_HOURS * 60 * 60 * 1000)
  const candidates = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff }, reservations: { some: { status: 'ACTIVE' } } },
    select: { id: true, orderNumber: true, stripeSessionId: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_ORDERS_PER_RUN,
  })

  let released = 0
  let skippedStillOpenOrPaid = 0
  const failures: { orderId: string; error: string }[] = []

  for (const order of candidates) {
    try {
      if (order.stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
        if (session.status === 'complete') {
          // A completed session with an order still PENDING locally means
          // the checkout.session.completed webhook hasn't been processed
          // yet (or failed) -- releasing here would be actively wrong.
          // Leave it for the webhook path; don't touch it.
          skippedStillOpenOrPaid++
          continue
        }
        if (session.status === 'open' && session.expires_at * 1000 > Date.now()) {
          // Stripe itself still considers this session open and unexpired
          // -- our local hold window is intentionally conservative, but
          // never release ahead of Stripe's own authoritative expiry.
          skippedStillOpenOrPaid++
          continue
        }
      }
      await markOrderPaymentFailedOrReturned({
        orderId: order.id,
        status: 'CANCELLED',
        reason: 'Reservation released by scheduled reconciliation -- checkout abandoned or session expired',
      })
      released++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      failures.push({ orderId: order.id, error: message })
      console.error(`[release-abandoned-reservations] Failed to release order ${order.orderNumber} (${order.id}):`, err)
    }
  }

  return NextResponse.json({ candidates: candidates.length, released, skipped: skippedStillOpenOrPaid, failed: failures.length, failures })
}
