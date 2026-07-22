// GET /api/intake/[token]/zip-lookup?zip=90210 — the public counterpart to
// app/api/admin/zip-lookup/route.ts, gated by a valid intake token instead
// of Clerk admin auth. Shares its implementation via lib/zipLookup.ts.
import { NextRequest, NextResponse } from 'next/server'
import { validateIntakeLink } from '@/lib/intakeLinks'
import { lookupZip, ZipLookupError } from '@/lib/zipLookup'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const rateLimit = checkRateLimit(`intake-zip-lookup:${getClientIp(req)}`, 30, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests — please slow down.' }, { status: 429 })
  }

  const validation = await validateIntakeLink(token)
  if (!validation.valid) {
    return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 410 })
  }

  try {
    const result = await lookupZip(req.nextUrl.searchParams.get('zip') ?? '')
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ZipLookupError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[intake/zip-lookup GET]', err)
    return NextResponse.json({ error: 'ZIP lookup service unavailable — enter city/state manually' }, { status: 502 })
  }
}
