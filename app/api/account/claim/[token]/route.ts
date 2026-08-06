// POST /api/account/claim/[token] — the one endpoint that ever links a
// Clerk User to a Customer. Requires the caller to already be signed in
// (this path lives under /account(.*), already Clerk-protected by
// proxy.ts) and derives the "proof of ownership" email from Clerk's own
// server-side user object — never from anything in the request body.
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { claimPortalInvite } from '@/lib/portalInvites'
import { isPortalEnabled } from '@/lib/portalAuth'

interface RouteParams {
  params: Promise<{ token: string }>
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'This invitation link is not valid.',
  EXPIRED: 'This invitation link has expired. Contact us for a new one.',
  REVOKED: 'This invitation link is no longer active. Contact us for a new one.',
  ALREADY_CLAIMED: 'This invitation has already been used.',
  EMAIL_MISMATCH: 'The signed-in email does not match the invited account. Sign in with the email this invitation was sent to.',
  USER_ALREADY_LINKED: 'This login is already linked to a different Pepscore account.',
  CUSTOMER_ALREADY_LINKED: 'This account has already been claimed by a different login.',
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  if (!isPortalEnabled()) return NextResponse.json({ error: 'Account setup is not available yet.' }, { status: 403 })

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clerkUser = await currentUser()
  const verifiedEmail =
    clerkUser?.primaryEmailAddress?.verification?.status === 'verified' ? clerkUser.primaryEmailAddress.emailAddress : null

  if (!verifiedEmail) {
    return NextResponse.json({ error: 'Your account email is not verified yet. Verify your email, then try this link again.' }, { status: 400 })
  }

  const { token } = await params
  const result = await claimPortalInvite({ token, clerkUserId: userId, clerkVerifiedEmail: verifiedEmail })

  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGES[result.reason] ?? 'Could not claim this account.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
