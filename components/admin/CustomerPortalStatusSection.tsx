// Read-only "Customer Portal" status summary for the customer profile page.
// Reuses computePortalAdoptionOverview()'s per-customer entry (the same
// derivation the /admin/portal-rollout dashboard and audit report use) so
// this page can never disagree with the fleet-wide numbers about where a
// given customer stands. Actions (invite/resend/revoke/enable/disable) stay
// in PortalAccessSection.tsx below this — this section is display-only.
import Link from 'next/link'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'
import type { PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'
import { PORTAL_ADOPTION_STATUS_LABEL as STATUS_LABEL, PORTAL_ADOPTION_STATUS_STYLE as STATUS_STYLE } from '@/lib/portal/adoptionStatusDisplay'

export function CustomerPortalStatusSection({
  status,
  reason,
  invite,
  activatedAt,
}: {
  status: PortalAdoptionStatus
  reason: string | null
  invite: {
    createdAt: Date
    expiresAt: Date
    channel: string
    remindersSent: number
    lastReminderAt: Date | null
    revokedAt: Date | null
  } | null
  activatedAt: Date | null
}) {
  return (
    <div className={`${card} p-6 space-y-3`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className={sectionHeading}>Customer Portal</h3>
        <span className={`text-xs font-heading font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {reason ? <p className={`text-sm ${mutedText}`}>{reason}</p> : null}

      {status === 'IDENTITY_REVIEW_REQUIRED' ? (
        <Link href="/admin/identity-review" className="text-sm text-gold hover:text-gold-light underline">
          Review in queue →
        </Link>
      ) : null}

      {invite || activatedAt ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-1">
          {invite ? (
            <>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Last Invited</dt>
                <dd className="text-white">{invite.createdAt.toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Channel</dt>
                <dd className="text-white">{invite.channel}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Reminders Sent</dt>
                <dd className="text-white">
                  {invite.remindersSent}
                  {invite.lastReminderAt ? ` (last ${invite.lastReminderAt.toLocaleDateString()})` : ''}
                </dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>{invite.revokedAt ? 'Revoked' : 'Invite Expires'}</dt>
                <dd className="text-white">
                  {invite.revokedAt ? invite.revokedAt.toLocaleDateString() : invite.expiresAt.toLocaleDateString()}
                </dd>
              </div>
            </>
          ) : null}
          {activatedAt ? (
            <div>
              <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Account Activated</dt>
              <dd className="text-white">{activatedAt.toLocaleDateString()}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  )
}
