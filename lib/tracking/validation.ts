// Best-effort tracking-number format checks. Deliberately advisory, not
// enforced — per spec, an inconclusive format should warn, never block a
// save. These patterns cover the common cases for each carrier; a tracking
// number that doesn't match still saves and registers with the provider,
// which is the real source of truth anyway.
import type { ShippingCarrier } from '@prisma/client'

const PATTERNS: Partial<Record<ShippingCarrier, RegExp>> = {
  USPS: /^(94|93|92|94|95)\d{20}$|^([A-Z]{2}\d{9}US)$/i,
  UPS: /^1Z[0-9A-Z]{16}$/i,
  FEDEX: /^\d{12}$|^\d{15}$|^\d{20}$/,
  DHL: /^\d{10,11}$/,
}

export interface TrackingFormatCheck {
  looksValid: boolean
  warning?: string
}

export function checkTrackingNumberFormat(carrier: ShippingCarrier, trackingNumber: string): TrackingFormatCheck {
  const trimmed = trackingNumber.trim()
  if (!trimmed) return { looksValid: false, warning: 'Tracking number is empty.' }

  const pattern = PATTERNS[carrier]
  if (!pattern) {
    // No known format for this carrier (or it's a non-trackable carrier like
    // PICKUP) — nothing to conclusively check, so don't warn either.
    return { looksValid: true }
  }
  if (pattern.test(trimmed)) return { looksValid: true }

  return {
    looksValid: false,
    warning: `This doesn't look like a typical ${carrier} tracking number format — it will still be saved and registered, but double-check it if tracking doesn't update.`,
  }
}
