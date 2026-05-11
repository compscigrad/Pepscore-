'use client'

import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs'

export function ClerkAuthButtons() {
  return (
    <>
      <SignedIn>
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
