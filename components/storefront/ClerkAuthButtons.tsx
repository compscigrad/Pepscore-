'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, SignInButton, useAuth } from '@clerk/nextjs'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

// Shows an "Admin" link in the header for the signed-in admin only. The
// admin check happens server-side via /api/admin/whoami — this component
// never sees ADMIN_CLERK_USER_ID itself, just the resulting boolean.
function AdminLink() {
  const { isSignedIn } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // isAdmin already defaults to false, so signed-out just skips the fetch
    // rather than setting state synchronously in the effect body.
    if (!isSignedIn) return
    fetch('/api/admin/whoami')
      .then((res) => res.json())
      .then((data) => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [isSignedIn])

  if (!isAdmin) return null

  return (
    <Link
      href="/admin/invoices"
      className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-[#D4AF37] hover:text-[#E8C84A] transition-colors"
    >
      Admin
    </Link>
  )
}

export function ClerkAuthButtons() {
  return (
    <>
      <SignedIn>
        <AdminLink />
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        {/* fallbackRedirectUrl carries the explicit customer-intent signal
            (?portal=customer) that app/account/page.tsx's
            shouldRedirectAdminToAdminDashboard() checks -- so this click
            always resolves to customer intent, never silently inherited
            from whatever Clerk session happens to exist (same pattern the
            landing page's Customer Portal CTA already uses). Hidden below
            md -- on mobile this same action lives inside the hamburger
            menu instead (MobileClientSignIn below), which is what
            actually fixed the reported collision with the "Lab" wordmark:
            removing it from the cramped top row, not just shrinking it. */}
        <SignInButton mode="modal" fallbackRedirectUrl="/account?portal=customer">
          <button
            id="client-sign-in-cta"
            onClick={() => trackEvent(AnalyticsEvent.CLIENT_SIGN_IN_CLICK)}
            className="hidden md:inline-flex font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/80 hover:text-[#D4AF37] transition-colors"
          >
            Client Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </>
  )
}

// Mobile-menu counterpart to the header's desktop-only "Client Sign In"
// button above -- only ever rendered inside Header.tsx's md:hidden mobile
// menu, and only when signed out (a signed-in mobile visitor already sees
// their UserButton in the always-visible top bar, so nothing else is
// needed here for them).
export function MobileClientSignIn() {
  return (
    <SignedOut>
      <SignInButton mode="modal" fallbackRedirectUrl="/account?portal=customer">
        <button
          onClick={() => trackEvent(AnalyticsEvent.CLIENT_SIGN_IN_CLICK)}
          className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-[#D4AF37] hover:text-[#F0D375] text-left transition-colors"
        >
          Client Sign In / Create Account
        </button>
      </SignInButton>
    </SignedOut>
  )
}
