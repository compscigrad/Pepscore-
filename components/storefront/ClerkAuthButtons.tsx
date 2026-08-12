'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, SignInButton, useAuth } from '@clerk/nextjs'

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
            landing page's Customer Portal CTA already uses). */}
        <SignInButton mode="modal" fallbackRedirectUrl="/account?portal=customer">
          <button className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/80 hover:text-[#D4AF37] transition-colors">
            Customer Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </>
  )
}
