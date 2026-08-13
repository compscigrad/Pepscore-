// Has the current signed-in customer already accepted the current RUO
// version? Used by CheckoutForm to decide whether to skip the modal for a
// returning, already-accepted customer -- never used to gate guests
// (guests always re-accept per checkout, no lookup needed).
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasAcceptedCurrentRuo, RUO_VERSION } from '@/lib/compliance/ruo'
import { findUserIdByClerkId } from '@/lib/user'

export async function GET() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ accepted: false, version: RUO_VERSION })

  // Read-only lookup -- a signed-in visitor who has never triggered a User
  // row (upsertUserByClerkId only ever runs on a real write path) has by
  // definition never recorded an acceptance either, so there's nothing to
  // upsert just to answer this status check.
  const internalUserId = await findUserIdByClerkId(clerkUserId)
  if (!internalUserId) return NextResponse.json({ accepted: false, version: RUO_VERSION })

  const accepted = await hasAcceptedCurrentRuo(internalUserId)
  return NextResponse.json({ accepted, version: RUO_VERSION })
}
