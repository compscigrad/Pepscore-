// Customer-facing account-security summary (Auth Sprint P3). Deliberately
// thin: current identity + last sign-in are simple facts we already have,
// everything else (password, passkeys, MFA, active-device sign-out) defers
// entirely to Clerk's own <UserProfile/> via openUserProfile() — never a
// custom-built weaker equivalent.
'use client'

import { useClerk } from '@clerk/nextjs'
import { card, mutedText, sectionHeading, pillOutline } from '@/components/invoices/theme'

interface AccountSecuritySectionProps {
  signedInEmail: string | null
  emailVerified: boolean
  lastSignInAt: string | null
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AccountSecuritySection({ signedInEmail, emailVerified, lastSignInAt }: AccountSecuritySectionProps) {
  const { openUserProfile } = useClerk()

  return (
    <div className={`${card} p-6 space-y-3`}>
      <h3 className={sectionHeading}>Account Security</h3>
      <div className="space-y-1 text-sm">
        <p className="text-white">
          Signed in as {signedInEmail ?? 'unknown'}
          {emailVerified ? <span className="text-gold-light"> (verified)</span> : <span className="text-amber-300"> (not verified)</span>}
        </p>
        <p className={mutedText}>Last sign-in: {formatDateTime(lastSignInAt)}</p>
      </div>
      <button type="button" className={`${pillOutline} px-4 py-2`} onClick={() => openUserProfile()}>
        Manage Password, Passkeys & Sign-In Security
      </button>
    </div>
  )
}
