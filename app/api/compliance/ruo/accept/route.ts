// Standalone RUO acceptance -- records a signed-in customer's one-time
// acceptance of the current version outside any specific order (e.g. from
// the account-creation/onboarding gate). Guests must use the per-checkout
// acceptance path in /api/checkout instead; this route always requires a
// real Clerk session.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { recordRuoAcceptance } from '@/lib/compliance/ruo'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const rl = checkRateLimit(`ruo-accept:${userId}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment.' }, { status: 429 })
  }

  await recordRuoAcceptance({
    userId,
    source: 'standalone',
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}
