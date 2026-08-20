// Professional Access invite landing — reached via the link in a
// ProfessionalAccessInvite email (2026-08-19 Professional Access sprint,
// section 12). Not under /account(.*), so unlike the portal claim page this
// isn't auto-protected by proxy.ts's middleware matcher -- the sign-in
// redirect below is this page's own real gate, not a redundant backstop.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { validateProfessionalAccessInvite } from '@/lib/professionalAccess/invites'
import { ProfessionalAccessInviteButton } from '@/components/storefront/ProfessionalAccessInviteButton'

const REASON_COPY: Record<string, { heading: string; body: string }> = {
  NOT_FOUND: {
    heading: 'Invitation not found',
    body: "This link doesn't match anything on file. Double-check the link, or contact us for a new one.",
  },
  EXPIRED: {
    heading: 'This invitation has expired',
    body: 'For your security, Professional Access invitations expire after a while. Contact us and we can send a fresh one.',
  },
  REVOKED: {
    heading: 'This invitation is no longer active',
    body: 'This invitation has been deactivated. Contact us and we can send a new one.',
  },
  ALREADY_ACCEPTED: {
    heading: 'Already accepted',
    body: 'This invitation has already been used. Sign in with the account you used to accept it.',
  },
}

function StatusShell({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-[#D4AF37]/15 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE <span className="text-[#D4AF37]">LAB</span></h1>
        <p className="text-[#D4AF37] text-xs uppercase tracking-[0.2em] mb-6">Professional Access</p>
        <h2 className="text-lg font-bold text-white mb-3">{heading}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{body}</p>
      </div>
    </main>
  )
}

export default async function ProfessionalAccessInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { userId } = await auth()
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/professional-access/invite/${token}`)}`)

  const validation = await validateProfessionalAccessInvite(token)
  if (!validation.valid) {
    const copy = REASON_COPY[validation.reason] ?? REASON_COPY.NOT_FOUND
    return <StatusShell heading={copy.heading} body={copy.body} />
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-[#D4AF37]/15 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE <span className="text-[#D4AF37]">LAB</span></h1>
        <p className="text-[#D4AF37] text-xs uppercase tracking-[0.2em] mb-6">Professional Access</p>
        <h2 className="text-lg font-bold text-white mb-3">You&apos;re invited to Professional Access</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          Accepting this invitation activates Professional Case pricing on your account immediately. Preferred case
          pricing changes purchasing terms only — it does not change the Research Use Only status of any product.
        </p>
        <ProfessionalAccessInviteButton token={token} />
      </div>
    </main>
  )
}
