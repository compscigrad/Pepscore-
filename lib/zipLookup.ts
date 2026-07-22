// US ZIP -> city/state lookup, shared by the admin zip-lookup route
// (app/api/admin/zip-lookup/route.ts) and the public intake-form equivalent
// (app/api/intake/[token]/zip-lookup/route.ts) — factored out so both share
// one implementation instead of the intake route duplicating the fetch.
const ZIPPOPOTAM_BASE_URL = 'https://api.zippopotam.us/us'

interface ZippopotamResponse {
  places?: Array<{
    'place name'?: string
    'state abbreviation'?: string
  }>
}

export interface ZipLookupResult {
  city: string
  state: string
}

export class ZipLookupError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Throws ZipLookupError with a caller-safe message on any failure — callers
// map it straight to an HTTP response without inspecting third-party details.
export async function lookupZip(rawZip: string): Promise<ZipLookupResult> {
  // ZIP+4 (e.g. "90210-1234") narrows to a delivery segment within the same
  // city/state as its base 5 digits — only those 5 digits matter here.
  const zip5 = rawZip.match(/^\d{5}/)?.[0]
  if (!zip5) {
    throw new ZipLookupError('Enter a 5-digit ZIP code', 400)
  }

  let res: Response
  try {
    res = await fetch(`${ZIPPOPOTAM_BASE_URL}/${zip5}`)
  } catch (err) {
    console.error('[zipLookup] fetch failed:', err)
    throw new ZipLookupError('ZIP lookup service unavailable — enter city/state manually', 502)
  }

  if (!res.ok) {
    throw new ZipLookupError('ZIP code not found', 404)
  }

  const data: ZippopotamResponse = await res.json()
  const place = data.places?.[0]
  const city = place?.['place name']
  const state = place?.['state abbreviation']
  if (!city || !state) {
    throw new ZipLookupError('ZIP code not found', 404)
  }

  return { city, state }
}
