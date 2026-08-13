// Pre-signup RUO/21+ gate (2026-08-12) -- this route is the single
// authoritative interception point for every "create an account" entry
// point in the app: the header's Client Sign In modal's own "Sign up" link
// navigates here (Clerk's default signUpUrl, unconfigured/unchanged), the
// dedicated /sign-in page's "Sign up" link does the same, and a direct URL
// visit lands here too -- there is no second signup route anywhere to
// bypass through. <SignUp/> is only ever rendered after a valid,
// server-verified pending RUO acceptance exists; a visitor without one
// sees RuoSignupGate instead, and Clerk's signup fields never mount.
export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { SignUp } from '@clerk/nextjs'
import { hasValidPendingRuoAcceptance, RUO_PENDING_COOKIE } from '@/lib/compliance/ruo'
import { RuoSignupGate } from '@/components/storefront/RuoSignupGate'

export default async function SignUpPage() {
  // An already-authenticated visitor landing here (e.g. a stale bookmark)
  // is Clerk's own concern -- it shows its own "already signed in" state
  // rather than the sign-up form -- so the gate is never shown to them.
  // Never re-prompts an existing session for a brand-new-account flow it
  // isn't going through.
  const { userId } = await auth()

  let gatePassed = Boolean(userId)
  if (!gatePassed) {
    const pendingToken = (await cookies()).get(RUO_PENDING_COOKIE)?.value
    gatePassed = pendingToken ? await hasValidPendingRuoAcceptance(pendingToken) : false
  }

  if (!gatePassed) {
    return <RuoSignupGate />
  }

  // forceRedirectUrl (not the fallback variant) so a customer arriving via
  // the landing page's "Set Up My Account" CTA always lands on /account --
  // which is also where self-service resolution (see app/account/page.tsx's
  // NOT_LINKED branch) runs for a freshly-created Clerk identity, and where
  // the pending RUO acceptance recorded above gets linked to that new account.
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <SignUp forceRedirectUrl="/account" />
    </div>
  )
}
