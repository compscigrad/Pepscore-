// POST /api/professional-access/invite/[token]/claim — the one endpoint
// that ever grants Professional Access via an admin-initiated invite
// (2026-08-19 Professional Access sprint, section 12). Requires the caller
// to already be signed in; derives the "proof of ownership" email from
// Clerk's own server-side user object, never from the request body -- same
// discipline as /api/account/claim/[token].
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { claimProfessionalAccessInvite } from '@/lib/professionalAccess/invites'

interface RouteParams {
  params: Promise<{ token: string }>
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'This invitation link is not valid.',
  EXPIRED: 'This invitation link has expired. Contact us for a new one.',
  REVOKED: 'This invitation link is no longer active. Contact us for a new one.',
  ALREADY_ACCEPTED: 'This invitation has already been used.',
  EMAIL_MISMATCH: 'The signed-in email does not match the invited address. Sign in with the email this invitation was sent to.',
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clerkUser = await currentUser()
  const verifiedEmail =
    clerkUser?.primaryEmailAddress?.verification?.status === 'verified' ? clerkUser.primaryEmailAddress.emailAddress : null

  if (!verifiedEmail) {
    return NextResponse.json({ error: 'Your account email is not verified yet. Verify your email, then try this link again.' }, { status: 400 })
  }

  const { token } = await params
  const result = await claimProfessionalAccessInvite({ token, clerkUserId: userId, clerkVerifiedEmail: verifiedEmail })

  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGES[result.reason] ?? 'Could not accept this invitation.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
