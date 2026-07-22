// GET /api/admin/zip-lookup?zip=90210 — looks up city/state for a US ZIP
// code, for the billing/shipping address auto-fill in the invoice builder.
// Proxied server-side rather than calling the lookup service directly from
// the browser: keeps the third-party dependency an implementation detail
// that can be swapped without touching client code, and puts it behind the
// same admin-auth gate as every other invoice-admin endpoint rather than
// leaving an open, unauthenticated relay anyone could hit.
//
// Shares its implementation with the public intake-form equivalent
// (app/api/intake/[token]/zip-lookup/route.ts) via lib/zipLookup.ts.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { lookupZip, ZipLookupError } from '@/lib/zipLookup'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const result = await lookupZip(req.nextUrl.searchParams.get('zip') ?? '')
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ZipLookupError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[admin/zip-lookup GET]', err)
    return NextResponse.json({ error: 'ZIP lookup service unavailable — enter city/state manually' }, { status: 502 })
  }
}
