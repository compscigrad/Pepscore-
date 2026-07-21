// Single lookup point mapping a carrier to the ShippingProvider that handles
// it. Only Shippo is implemented today (it already covers USPS/UPS/FedEx/DHL
// under one API), but every carrier's provider is resolved through here —
// swapping one carrier to a direct-carrier adapter later means adding one
// adapter file and one line here, nothing in invoice code changes.
import type { ShippingCarrier } from '@prisma/client'
import type { ShippingProvider } from './types'
import { isTrackableCarrier } from './types'
import { shippoProvider } from './shippoProvider'

export function getProviderForCarrier(carrier: ShippingCarrier): ShippingProvider | null {
  if (!isTrackableCarrier(carrier)) return null
  return shippoProvider
}

// Every registered provider, keyed by name — used by the webhook route to
// find the right provider to verify/normalize an inbound payload without
// needing to know which carrier it's for ahead of time.
export function getProviderByName(name: string): ShippingProvider | null {
  return name === shippoProvider.name ? shippoProvider : null
}
