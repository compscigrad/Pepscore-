// Portal account-claim landing — reached via the link in a
// CustomerPortalInvite email. Lives under /account(.*), so proxy.ts's
// existing Clerk middleware already guarantees a signed-in user by the time
// this renders; the actual ownership check (does the signed-in email match
// the invited customer) happens server-side in the claim API route, never
// here or client-side.
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { validatePortalInvite } from '@/lib/portalInvites'
import { getPortalAuthState } from '@/lib/portalAuth'
import { PortalClaimButton } from '@/components/account/PortalClaimButton'

const REASON_COPY: Record<string, { heading: string; body: string }> = {
  NOT_FOUND: {
    heading: 'Invitation not found',
    body: "This link doesn't match anything on file. Double-check the link, or contact us for a new one.",
  },
  EXPIRED: {
    heading: 'This invitation has expired',
    body: 'For your security, account invitations expire after a while. Contact us and we can send a fresh one.',
  },
  REVOKED: {
    heading: 'This invitation is no longer active',
    body: 'This invitation has been deactivated. Contact us and we can send a new one.',
  },
  ALREADY_CLAIMED: {
    heading: 'Already set up',
    body: 'This account has already been claimed. Sign in with the account you used to set it up.',
  },
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Already linked (to this customer or any other) — nothing to claim.
  const authState = await getPortalAuthState()
  if (authState.state === 'AUTHORIZED') redirect('/account')

  const validation = await validatePortalInvite(token)

  if (!validation.valid) {
    const copy = REASON_COPY[validation.reason] ?? REASON_COPY.NOT_FOUND
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE</h1>
          <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">Account Setup</p>
          <h2 className="text-lg font-bold text-white mb-3">{copy.heading}</h2>
          <p className="text-white/60 text-sm leading-relaxed">{copy.body}</p>
        </div>
      </main>
    )
  }

  const { customer } = validation

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE</h1>
        <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">Account Setup</p>
        <h2 className="text-lg font-bold text-white mb-3">
          Hi {customer.firstName}, set up your account
        </h2>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          This will link your Pepscore order history to the account you&apos;re signed in with, so you can view your
          invoices, tracking, and payment history anytime.
        </p>
        <PortalClaimButton token={token} />
      </div>
    </main>
  )
}
