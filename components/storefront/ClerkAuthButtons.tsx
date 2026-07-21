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
      className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-gold-dark hover:text-gold transition-colors"
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
        <SignInButton mode="modal">
          <button className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-dark hover:text-gold transition-colors">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </>
  )
}
