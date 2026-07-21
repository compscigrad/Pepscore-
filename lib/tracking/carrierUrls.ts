// Carrier tracking-page URL builder, keyed on our own ShippingCarrier enum
// rather than a free-text string (the pre-existing `getCarrierTrackingUrl` in
// app/api/shipping/labels/route.ts matched on substrings of Shippo's carrier
// name — fine there since it only ever sees Shippo's own strings, but this
// version needs to work from the enum the invoice/tracking UI actually uses).
import type { ShippingCarrier } from '@prisma/client'

export function buildCarrierTrackingUrl(carrier: ShippingCarrier, trackingNumber: string): string {
  const encoded = encodeURIComponent(trackingNumber)
  switch (carrier) {
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${encoded}`
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`
    case 'DHL':
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`
    default:
      return `https://www.google.com/search?q=${encoded}`
  }
}
