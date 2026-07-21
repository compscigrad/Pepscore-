// GET /api/cron/poll-tracking — polling fallback for shipments that don't
// receive webhook updates (see vercel.json for the schedule). Webhooks are
// the preferred update path; this just catches whatever they miss.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshShipmentTracking } from '@/lib/tracking/service'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Only re-check a shipment if it's been at least this long since the last
// check — avoids hammering the provider API on every cron tick for
// shipments that were just refreshed by a webhook or a previous poll.
const MIN_RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const MAX_SHIPMENTS_PER_RUN = 50
const RETRY_DELAYS_MS = [1000, 3000]

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollWithRetry(shipmentId: string): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await refreshShipmentTracking(shipmentId, 'POLLING')
      return { ok: true }
    } catch (err) {
      if (attempt === RETRY_DELAYS_MS.length) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  return { ok: false, error: 'Unreachable' }
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - MIN_RECHECK_INTERVAL_MS)
  const shipments = await prisma.shipment.findMany({
    where: {
      monitoringActive: true,
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: cutoff } }],
    },
    select: { id: true },
    take: MAX_SHIPMENTS_PER_RUN,
    orderBy: { lastCheckedAt: 'asc' },
  })

  let succeeded = 0
  const failures: { shipmentId: string; error: string }[] = []

  // Sequential, not parallel — this is a background sweep with no user
  // waiting on it, and staying sequential keeps provider API usage gentle
  // (never blocks the main invoice app either way, since it's a separate
  // cron-triggered route).
  for (const shipment of shipments) {
    const result = await pollWithRetry(shipment.id)
    if (result.ok) {
      succeeded++
    } else {
      failures.push({ shipmentId: shipment.id, error: result.error ?? 'Unknown error' })
      console.error(`[poll-tracking] Failed to refresh shipment ${shipment.id}:`, result.error)
    }
  }

  return NextResponse.json({ checked: shipments.length, succeeded, failed: failures.length, failures })
}
