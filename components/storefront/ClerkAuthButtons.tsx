'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, SignInButton, useAuth } from '@clerk/nextjs'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

// CRITICAL: every SignInButton below MUST use mode="redirect", never
// mode="modal" (2026-08-13 RUO-gate-bypass fix). Traced directly in
// @clerk/clerk-react's own source: mode="modal" calls clerk.openSignIn(),
// which does not accept a signUpUrl option at all -- modal mode's internal
// "Don't have an account? Sign up" link is hard-coded to swap the same
// modal to Clerk's native, un-gated sign-up form via its own virtual
// router (a synthetic href like /CLERK-ROUTER/VIRTUAL/sign-up), with no
// real navigation, no server round-trip, and no way to point it at
// app/sign-up/[[...sign-up]]/page.tsx's RuoSignupGate through any prop.
// mode="redirect" calls clerk.redirectToSignIn() instead, a real
// navigation to app/layout.tsx's ClerkProvider signInUrl ("/sign-in") --
// confirmed live via Playwright, both the bypass on mode="modal" and the
// fix on mode="redirect", against a real Clerk instance, not assumed from
// reading the code. From there, /sign-in's own "Sign up" link correctly
// honors ClerkProvider's signUpUrl ("/sign-up") and reaches the gate.

// Hover-intent delay before the tooltip appears -- long enough that
// quickly passing the cursor through the navbar on the way to something
// else never flashes it, short enough that someone actually pausing on
// the control sees it without feeling like it's late.
const HOVER_INTENT_DELAY_MS = 350

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

// Desktop-only hover/focus prompt (2026-08-13) -- replaces the previous
// one-time, localStorage-dismissed-forever ClientSignInCoachMark with a
// repeatable tooltip anchored directly to the button itself, since the two
// served the identical purpose (nudge an undecided visitor toward sign-in
// or account creation) in the same screen position; running both would
// have meant two differently-worded popups competing for the same spot.
// Shows on real hover intent (delayed) or keyboard focus, hides
// immediately on mouseleave/blur -- never gates on localStorage, so it
// reaches every visitor who pauses on the control, not just once ever.
function ClientSignInWithPrompt() {
  const [open, setOpen] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleShow() {
    if (showTimer.current) clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => setOpen(true), HOVER_INTENT_DELAY_MS)
  }
  function hide() {
    if (showTimer.current) clearTimeout(showTimer.current)
    setOpen(false)
  }

  useEffect(() => {
    if (open) trackEvent(AnalyticsEvent.COACH_MARK_IMPRESSION)
  }, [open])

  // Clears any pending show-timer if the component unmounts mid-delay
  // (e.g. navigating away right as the cursor enters the control).
  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current) }, [])

  return (
    // relative + hidden md:block -- mirrors the button's own previous
    // "hidden md:inline-flex" (this same action lives inside the hamburger
    // menu on mobile via MobileClientSignIn below instead). Wrapping the
    // button rather than sizing an invisible hover zone around it means
    // hovering exactly the visible control is what triggers the prompt,
    // nothing larger.
    <div className="relative hidden md:block" onMouseEnter={scheduleShow} onMouseLeave={hide} onFocus={() => setOpen(true)} onBlur={hide}>
      {/* fallbackRedirectUrl carries the explicit customer-intent signal
          (?portal=customer) that app/account/page.tsx's
          shouldRedirectAdminToAdminDashboard() checks -- so this click
          always resolves to customer intent, never silently inherited
          from whatever Clerk session happens to exist (same pattern the
          landing page's Customer Portal CTA already uses). */}
      <SignInButton mode="redirect" fallbackRedirectUrl="/account?portal=customer">
        <button
          id="client-sign-in-cta"
          onClick={() => trackEvent(AnalyticsEvent.CLIENT_SIGN_IN_CLICK)}
          aria-describedby="client-sign-in-tip"
          className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/80 hover:text-[#D4AF37] transition-colors"
        >
          Client Sign In
        </button>
      </SignInButton>

      {open && (
        // pointer-events-none -- purely informational, never intercepts a
        // click meant for the real button underneath or anything else.
        <div id="client-sign-in-tip" role="tooltip" className="absolute top-full right-0 mt-2.5 z-[950] w-[210px] pointer-events-none">
          <div className="absolute -top-[6px] right-5 w-3 h-3 bg-[#141414] border-t border-l border-[#D4AF37]/40 rotate-45" />
          <div className="relative bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-[#D4AF37]/40 rounded-xl px-3.5 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
            <p className="text-[12px] text-white/85 leading-snug">Sign in or create an account</p>
          </div>
        </div>
      )}
    </div>
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
        <ClientSignInWithPrompt />
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
      <SignInButton mode="redirect" fallbackRedirectUrl="/account?portal=customer">
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
