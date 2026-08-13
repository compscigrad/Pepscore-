// Standalone RUO acceptance -- records a signed-in customer's one-time
// acceptance of the current version outside any specific order (e.g. the
// established protected-boundary prompt for an existing customer who
// hasn't accepted the current version yet). Guests must use the
// per-checkout acceptance path in /api/checkout instead; this route always
// requires a real Clerk session with a verified email (same trust boundary
// lib/portal/selfServiceResolve.ts already relies on).
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { recordRuoAcceptance } from '@/lib/compliance/ruo'
import { upsertUserByClerkId } from '@/lib/user'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const rl = checkRateLimit(`ruo-accept:${clerkUserId}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment.' }, { status: 429 })
  }

  const clerkUser = await currentUser()
  const primaryEmail = clerkUser?.primaryEmailAddress
  if (!primaryEmail || primaryEmail.verification?.status !== 'verified') {
    return NextResponse.json({ error: 'A verified email is required to record acceptance.' }, { status: 400 })
  }

  // ComplianceAcknowledgment.userId is a real foreign key to the internal
  // User.id, not the raw Clerk id -- resolve/create that row first (see
  // lib/compliance/ruo.ts's RecordAcceptanceParams comment for why this
  // matters: skipping this step throws a foreign-key violation).
  const user = await upsertUserByClerkId(clerkUserId, primaryEmail.emailAddress)

  await recordRuoAcceptance({
    userId: user.id,
    source: 'standalone',
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}
