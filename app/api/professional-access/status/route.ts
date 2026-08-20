// GET /api/professional-access/status — lightweight, read-only check for
// client components that aren't already part of a server-rendered page
// (the cart sidebar, the checkout page) to know whether the current
// visitor is Professional-eligible, so they can suppress standard-tier
// volume-discount messaging per section 1's explicit rule ("Professional
// pricing supersedes the volume ladder — do not show standard volume-tier
// messaging to Professional accounts"). Same authenticated-only resolution
// as checkout's own entitlement check -- never an email match.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { resolveProEligibleByClerkUserId } from '@/lib/storefront/professionalAccess'

export async function GET() {
  const { userId } = await auth()
  const proEligible = await resolveProEligibleByClerkUserId(userId ?? null)
  return NextResponse.json({ proEligible })
}
