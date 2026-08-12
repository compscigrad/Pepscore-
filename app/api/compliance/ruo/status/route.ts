// Has the current signed-in customer already accepted the current RUO
// version? Used by CheckoutForm to decide whether to skip the modal for a
// returning, already-accepted customer -- never used to gate guests
// (guests always re-accept per checkout, no lookup needed).
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { hasAcceptedCurrentRuo, RUO_VERSION } from '@/lib/compliance/ruo'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ accepted: false, version: RUO_VERSION })

  const accepted = await hasAcceptedCurrentRuo(userId)
  return NextResponse.json({ accepted, version: RUO_VERSION })
}
