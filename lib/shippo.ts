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
}

// Get shipping rates for a shipment
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
      async: false,
    }),
  })
  const data = await res.json()
  return data.rates ?? []
}

// Purchase a label using a rate object_id
export async function purchaseLabel(rateObjectId: string): Promise<ShippoLabel> {
  const res = await fetch(`${SHIPPO_BASE}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      rate: rateObjectId,
      label_file_type: 'PDF',
      async: false,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Shippo label purchase failed: ${JSON.stringify(err)}`)
  }
  return res.json()
}
