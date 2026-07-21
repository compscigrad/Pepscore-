// Deterministic dedup key for a tracking event when the provider doesn't
// give us its own event id — combines with the (shipmentId, eventHash)
// unique constraint on TrackingEvent so a re-delivered webhook or an
// overlapping poll can never create a duplicate row.
import { createHash } from 'crypto'
import type { NormalizedTrackingEvent } from './types'

export function computeEventHash(event: NormalizedTrackingEvent): string {
  if (event.providerEventId) return event.providerEventId
  const raw = `${event.normalizedStatus}|${event.carrierStatus}|${event.eventAt.toISOString()}`
  return createHash('sha256').update(raw).digest('hex')
}
