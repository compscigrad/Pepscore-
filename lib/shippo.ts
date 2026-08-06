// Shippo shipping label client — lazy initialization so build succeeds without env vars
// Docs: https://goshippo.com/docs/

const SHIPPO_BASE = 'https://api.goshippo.com'

function getHeaders() {
  const key = process.env.SHIPPO_API_KEY
  if (!key) throw new Error('Missing SHIPPO_API_KEY environment variable')
  return {
    Authorization: `ShippoToken ${key}`,
    'Content-Type': 'application/json',
  }
}

export interface AddressInput {
  name: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

export interface ParcelInput {
  length: string
  width: string
  height: string
  distance_unit: 'in' | 'cm'
  weight: string
  mass_unit: 'lb' | 'kg' | 'oz'
}

export interface ShippoRate {
  object_id: string
  amount: string
  currency: string
  provider: string
  servicelevel: { name: string; token: string }
  estimated_days: number
}

export interface ShippoLabel {
  object_id: string
  tracking_number: string
  label_url: string
  carrier: string
  servicelevel_name: string
  rate: { amount: string }
  // Only present when the underlying shipment requested one (see getRates'
  // qr_code_requested below) AND the purchased carrier/service actually
  // supports it (USPS, Royal Mail, Evri today — see
  // https://docs.goshippo.com/docs/Shipments/QRCode). label_url above is
  // always populated regardless, so a non-eligible purchase still has a
  // normal printable label — nothing is ever silently lost.
  qr_code_url?: string
}

// Get shipping rates for a shipment. Always requests a printerless QR code
// (extra.qr_code_requested) — harmless for carriers that don't support one,
// since Shippo simply omits qr_code_url from the eventual purchase response
// in that case rather than rejecting the request. This keeps QR-eligible
// USPS service levels available as an option on every rate-shopping call
// without the caller needing to know carrier eligibility up front.
export async function getRates(
  addressFrom: AddressInput,
  addressTo: AddressInput,
  parcel: ParcelInput
): Promise<ShippoRate[]> {
  const res = await fetch(`${SHIPPO_BASE}/shipments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      address_from: addressFrom,
      address_to: addressTo,
      parcels: [parcel],
      extra: { qr_code_requested: true },
      async: false,
    }),
  })
  const data = await res.json()
  return data.rates ?? []
}

// Purchase a label using a rate object_id. labelFileType defaults to 'PDF'
// (unchanged for the existing Order-checkout caller); the invoice
// fulfillment flow passes 'PDF_4x6', sized for thermal label printers.
export async function purchaseLabel(rateObjectId: string, labelFileType: string = 'PDF'): Promise<ShippoLabel> {
  const res = await fetch(`${SHIPPO_BASE}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      rate: rateObjectId,
      label_file_type: labelFileType,
      async: false,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Shippo label purchase failed: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  // Shippo can return HTTP 201 with the actual purchase having failed —
  // status: "ERROR" in the body, label_url/tracking_number left blank, and
  // the real reason in messages[]. A plain res.ok check misses this
  // entirely and would otherwise silently "succeed" with a useless empty
  // label. Confirmed live in test mode: a return address missing phone/
  // email produces exactly this shape ("Seller email and phone number
  // required for USPS").
  if (data.status === 'ERROR') {
    const reason = Array.isArray(data.messages) && data.messages.length > 0 ? data.messages.map((m: { text?: string }) => m.text).join('; ') : 'Unknown error'
    throw new Error(`Shippo label purchase failed: ${reason}`)
  }
  return data
}
