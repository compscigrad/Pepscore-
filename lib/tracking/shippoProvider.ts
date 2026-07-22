// Shippo Track API adapter — the only ShippingProvider implementation today.
// Shippo is a multi-carrier tracking aggregator (USPS/UPS/FedEx/DHL and many
// more all through one API), which is why it's the provider of choice per
// the tracking spec's "prefer a multi-carrier API" guidance — this repo
// already depends on Shippo for label purchases (lib/shippo.ts), so no new
// vendor/credential is introduced.
import { timingSafeEqual } from 'crypto'
import type { ShippingCarrier, ShippingStatus } from '@prisma/client'
import type {
  ShippingProvider,
  TrackingResult,
  RegisterTrackingResult,
  NormalizedTrackingEvent,
} from './types'
import { buildCarrierTrackingUrl } from './carrierUrls'

// timingSafeEqual throws on mismatched buffer lengths rather than returning
// false, so the length check has to happen first — this is the standard,
// widely-used shape for a constant-time string comparison.
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

const SHIPPO_BASE = 'https://api.goshippo.com'

function getHeaders() {
  const key = process.env.SHIPPO_API_KEY
  if (!key) throw new Error('Missing SHIPPO_API_KEY environment variable')
  return {
    Authorization: `ShippoToken ${key}`,
    'Content-Type': 'application/json',
  }
}

// Our ShippingCarrier enum -> Shippo's own carrier token vocabulary.
// isTrackableCarrier() in types.ts already excludes PICKUP/HAND_DELIVERY/
// COURIER/OTHER before this is ever called, so every carrier reaching here
// has a real Shippo token.
const SHIPPO_CARRIER_TOKEN: Partial<Record<ShippingCarrier, string>> = {
  USPS: 'usps',
  UPS: 'ups',
  FEDEX: 'fedex',
  DHL: 'dhl_express',
}

function toShippoCarrier(carrier: ShippingCarrier): string {
  const token = SHIPPO_CARRIER_TOKEN[carrier]
  if (!token) throw new Error(`Carrier ${carrier} is not supported for automated tracking`)
  return token
}

// Shippo's own status vocabulary (UNKNOWN/PRE_TRANSIT/TRANSIT/DELIVERED/
// RETURNED/FAILURE) is much coarser than our 16-value ShippingStatus, so this
// leans on the human-readable status_details text for the finer distinctions
// (delayed, out for delivery, exception, pickup, attempted) — heuristic by
// necessity, since Shippo doesn't expose a more granular enum itself.
// Exported for unit testing (lib/tracking/shippoProvider.test.ts) — not used
// outside this file otherwise.
export function mapShippoStatus(status: string, statusDetails: string): ShippingStatus {
  const s = (status || '').toUpperCase()
  const details = (statusDetails || '').toLowerCase()

  if (details.includes('delivered')) return 'DELIVERED'
  if (s === 'DELIVERED') return 'DELIVERED'
  if (s === 'RETURNED') return 'RETURNED_TO_SENDER'
  if (details.includes('return to sender') || details.includes('returned')) return 'RETURNED_TO_SENDER'
  if (details.includes('delivery attempt')) return 'DELIVERY_ATTEMPTED'
  if (details.includes('out for delivery')) return 'OUT_FOR_DELIVERY'
  if (details.includes('available for pickup') || details.includes('ready for pickup')) return 'AVAILABLE_FOR_PICKUP'
  if (details.includes('exception') || s === 'FAILURE') return 'DELIVERY_EXCEPTION'
  if (details.includes('delay')) return 'DELAYED'
  if (details.includes('lost')) return 'LOST'
  if (s === 'TRANSIT') return 'IN_TRANSIT'
  if (s === 'PRE_TRANSIT') return 'ACCEPTED_BY_CARRIER'
  if (s === 'UNKNOWN' || !s) return 'UNKNOWN'
  return 'UNKNOWN'
}

interface ShippoTrackingHistoryEntry {
  object_id?: string
  status?: string
  status_details?: string
  status_date?: string
  location?: { city?: string; state?: string; country?: string }
}

interface ShippoTrackResponse {
  tracking_number: string
  carrier: string
  eta?: string
  tracking_status?: ShippoTrackingHistoryEntry
  tracking_history?: ShippoTrackingHistoryEntry[]
}

// Shippo's raw error JSON (e.g. `{"detail":"..."}`) is an implementation
// detail, not something an admin should see verbatim in a toast — it's
// confusing at best (why is a carrier API talking about "detail"?) and at
// worst looks like a broken error page. This maps the couple of error
// conditions we've actually hit to a plain-English admin-facing message,
// while the untouched raw response still goes to server logs (console.error
// at the call site) for anyone who needs to debug further. Deliberately not
// exhaustive — unrecognized errors fall back to a generic, still-readable
// message rather than the raw payload.
// Exported for unit testing (lib/tracking/shippoProvider.test.ts) — not used
// outside this file otherwise.
export function sanitizedShippoError(err: unknown, action: string): Error {
  console.error(`[shippoProvider] Shippo API error while trying to ${action}:`, err)

  const detail = typeof err === 'object' && err !== null && 'detail' in err ? String((err as { detail: unknown }).detail) : ''

  if (/payment method/i.test(detail)) {
    return new Error(
      'Shippo requires a payment method on file for this account before it will register or look up live tracking numbers. Add a card at Shippo → Settings → Billing, then try again.'
    )
  }
  if (/not a valid test tracking carrier/i.test(detail)) {
    return new Error(
      'This Shippo API key is in sandbox/test mode, which only accepts its fake test carrier for tracking — a live Shippo key is required for real USPS/UPS/FedEx/DHL tracking numbers.'
    )
  }

  return new Error(`Shippo could not ${action} right now. Check the carrier and tracking number, then try again.`)
}

function formatLocation(loc?: ShippoTrackingHistoryEntry['location']): string | undefined {
  if (!loc) return undefined
  return [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || undefined
}

function toNormalizedEvent(entry: ShippoTrackingHistoryEntry): NormalizedTrackingEvent {
  return {
    providerEventId: entry.object_id,
    normalizedStatus: mapShippoStatus(entry.status ?? '', entry.status_details ?? ''),
    carrierStatus: entry.status_details || entry.status || 'Unknown',
    description: entry.status_details || entry.status || 'Unknown',
    location: formatLocation(entry.location),
    eventAt: entry.status_date ? new Date(entry.status_date) : new Date(),
  }
}

function toTrackingResult(data: ShippoTrackResponse): TrackingResult {
  const events = (data.tracking_history ?? []).map(toNormalizedEvent)
  const current = data.tracking_status ? toNormalizedEvent(data.tracking_status) : events[0]

  return {
    normalizedStatus: current?.normalizedStatus ?? 'UNKNOWN',
    carrierStatus: current?.carrierStatus ?? 'Unknown',
    estimatedDeliveryAt: data.eta ? new Date(data.eta) : undefined,
    events,
  }
}

export const shippoProvider: ShippingProvider = {
  name: 'shippo',

  async registerTracking(carrier, trackingNumber): Promise<RegisterTrackingResult> {
    const res = await fetch(`${SHIPPO_BASE}/tracks/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ carrier: toShippoCarrier(carrier), tracking_number: trackingNumber }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw sanitizedShippoError(err, 'register tracking for this shipment')
    }
    const data: ShippoTrackResponse = await res.json()
    return {
      providerTrackingId: data.tracking_status?.object_id,
      trackingUrl: buildCarrierTrackingUrl(carrier, trackingNumber),
    }
  },

  async getTrackingStatus(carrier, trackingNumber): Promise<TrackingResult> {
    const res = await fetch(`${SHIPPO_BASE}/tracks/${toShippoCarrier(carrier)}/${encodeURIComponent(trackingNumber)}`, {
      headers: getHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw sanitizedShippoError(err, 'look up tracking for this shipment')
    }
    const data: ShippoTrackResponse = await res.json()
    return toTrackingResult(data)
  },

  // Shippo doesn't sign webhook payloads (no HMAC secret to verify against,
  // unlike Stripe) — the documented mitigation is a shared secret embedded in
  // the webhook URL itself when registering it with Shippo, e.g.
  // https://yourapp.com/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>.
  // See docs/Decisions.md for why, and SETUP.md for the exact registration
  // steps.
  async verifyWebhook(req: Request): Promise<boolean> {
    const secret = process.env.SHIPPO_WEBHOOK_SECRET
    if (!secret) return false
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return false
    return safeCompare(token, secret)
  },

  normalizeWebhookPayload(payload: unknown): NormalizedTrackingEvent[] {
    const data = payload as { data?: ShippoTrackResponse } | ShippoTrackResponse
    // Shippo's track_updated webhook wraps the Track object in a `data` key;
    // guard for both shapes in case that ever changes.
    const track: ShippoTrackResponse | undefined = 'data' in data && data.data ? data.data : (data as ShippoTrackResponse)
    if (!track) return []
    return toTrackingResult(track).events
  },
}
