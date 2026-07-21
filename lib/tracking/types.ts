// Carrier-agnostic tracking abstraction. Every provider adapter (Shippo today,
// a direct-carrier API later if ever needed) implements ShippingProvider —
// nothing outside lib/tracking/ ever talks to a carrier or tracking vendor
// directly, so swapping providers touches only registry.ts + one new adapter.
import type { ShippingCarrier, ShippingStatus } from '@prisma/client'

export interface NormalizedTrackingEvent {
  providerEventId?: string
  normalizedStatus: ShippingStatus
  // Original carrier event text — always preserved alongside the normalized
  // status, never discarded, per the tracking spec.
  carrierStatus: string
  description: string
  location?: string
  eventAt: Date
}

export interface TrackingResult {
  normalizedStatus: ShippingStatus
  carrierStatus: string
  estimatedDeliveryAt?: Date
  events: NormalizedTrackingEvent[]
}

export interface RegisterTrackingResult {
  providerTrackingId?: string
  trackingUrl: string
}

export interface ShippingProvider {
  readonly name: string
  registerTracking(carrier: ShippingCarrier, trackingNumber: string): Promise<RegisterTrackingResult>
  getTrackingStatus(carrier: ShippingCarrier, trackingNumber: string): Promise<TrackingResult>
  verifyWebhook(req: Request): Promise<boolean>
  normalizeWebhookPayload(payload: unknown): NormalizedTrackingEvent[]
}

// Carriers this app can request tracking numbers for — a strict subset of
// ShippingCarrier (PICKUP/HAND_DELIVERY/COURIER/OTHER have no trackable
// tracking-number format, so tracking registration is skipped for those).
export const TRACKABLE_CARRIERS: ShippingCarrier[] = ['USPS', 'UPS', 'FEDEX', 'DHL']

export function isTrackableCarrier(carrier: ShippingCarrier): boolean {
  return TRACKABLE_CARRIERS.includes(carrier)
}
