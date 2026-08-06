// Pure classification of a shipment's printerless-QR-code state, so the UI
// never has to inline the same three-way branch — and so it's unit-testable
// without a real Shippo call. Eligibility itself is decided entirely by
// Shippo (which carrier/service actually got purchased); this only
// classifies what the resulting Shipment row already says happened.
import type { ShipmentOrigin } from '@prisma/client'

export type QrCodeState = 'AVAILABLE' | 'NOT_ELIGIBLE' | 'NOT_APPLICABLE'

export function describeQrCodeState(shipment: {
  qrCodeUrl: string | null
  qrCodeRequested: boolean
  origin: ShipmentOrigin
}): QrCodeState {
  if (shipment.qrCodeUrl) return 'AVAILABLE'
  // Only a real Shippo label purchase ever requests a QR code — a manually
  // entered tracking number (Pirate Ship, hand-written, etc.) was never
  // eligible in the first place, so there's nothing to warn about.
  if (shipment.origin === 'LABEL_PURCHASE' && shipment.qrCodeRequested) return 'NOT_ELIGIBLE'
  return 'NOT_APPLICABLE'
}
