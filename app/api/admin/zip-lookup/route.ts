// GET /api/admin/zip-lookup?zip=90210 — looks up city/state for a US ZIP
// code, for the billing/shipping address auto-fill in the invoice builder.
// Proxied server-side rather than calling the lookup service directly from
// the browser: keeps the third-party dependency an implementation detail
// that can be swapped without touching client code, and puts it behind the
// same admin-auth gate as every other invoice-admin endpoint rather than
// leaving an open, unauthenticated relay anyone could hit.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

// Zippopotam.us: free, keyless, well-established US ZIP -> city/state
// lookup — no API key to provision (and nothing for us to keep secret),
// which is the deciding factor over something like the USPS Web Tools API
// that requires registering for credentials this project doesn't have.
const ZIPPOPOTAM_BASE_URL = 'https://api.zippopotam.us/us'

interface ZippopotamResponse {
  places?: Array<{
    'place name'?: string
    'state abbreviation'?: string
  }>
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const rawZip = req.nextUrl.searchParams.get('zip') ?? ''
  // ZIP+4 (e.g. "90210-1234") narrows to a delivery segment within the same
  // city/state as its base 5 digits — only those 5 digits matter here.
  const zip5 = rawZip.match(/^\d{5}/)?.[0]
  if (!zip5) {
    return NextResponse.json({ error: 'Enter a 5-digit ZIP code' }, { status: 400 })
  }

  try {
    const res = await fetch(`${ZIPPOPOTAM_BASE_URL}/${zip5}`)
    if (!res.ok) {
      return NextResponse.json({ error: 'ZIP code not found' }, { status: 404 })
    }

    const data: ZippopotamResponse = await res.json()
    const place = data.places?.[0]
    const city = place?.['place name']
    const state = place?.['state abbreviation']
    if (!city || !state) {
      return NextResponse.json({ error: 'ZIP code not found' }, { status: 404 })
    }

    return NextResponse.json({ city, state })
  } catch (err) {
    console.error('[admin/zip-lookup GET]', err)
    return NextResponse.json({ error: 'ZIP lookup service unavailable — enter city/state manually' }, { status: 502 })
  }
}
