// Shared "nothing to show, here's why" full-page shell for the portal —
// same visual pattern as components/intake/IntakeStatusMessage.tsx, reused
// here since both are pre-portal-nav, branded, centered messaging states.
//
// Every caller of this shell (NOT_LINKED, DISABLED) is reached by a signed-
// in Clerk session that never renders PortalNav (which is gated on
// AUTHORIZED) — without this, a disabled or not-yet-linked user had no
// visible way to sign out or switch accounts from this page at all. Found
// during the Auth Sprint's live test-matrix pass.
import { SignOutButton } from '@clerk/nextjs'

export function PortalStatusShell({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE <span className="text-gold-light">LAB</span></h1>
        <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">My Account</p>
        <h2 className="text-lg font-bold text-white mb-3">{heading}</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-6">{body}</p>
        <SignOutButton redirectUrl="/">
          <button type="button" className="text-white/40 hover:text-white text-xs font-heading font-bold uppercase tracking-[0.08em]">
            Sign Out
          </button>
        </SignOutButton>
      </div>
    </main>
  )
}
