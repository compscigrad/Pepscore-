// Read-only "Customer Portal" status summary for the customer profile page.
// Reuses computePortalAdoptionOverview()'s per-customer entry (the same
// derivation the /admin/portal-rollout dashboard and audit report use) so
// this page can never disagree with the fleet-wide numbers about where a
// given customer stands. Actions (invite/resend/revoke/enable/disable) stay
// in PortalAccessSection.tsx below this — this section is display-only.
import Link from 'next/link'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'
import type { PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'

const STATUS_LABEL: Record<PortalAdoptionStatus, string> = {
  NOT_ELIGIBLE: 'Not Yet Eligible',
  ELIGIBLE: 'Eligible — Not Yet Invited',
  INVITE_PENDING: 'Invite Pending Next Automated Run',
  INVITED: 'Invited',
  REMINDER_1_SENT: 'Invited — Reminder Sent',
  REMINDER_2_SENT: 'Invited — Final Reminder Sent',
  PORTAL_ACTIVE: 'Portal Active',
  EXCLUDED: 'Excluded',
  IDENTITY_REVIEW_REQUIRED: 'Needs Identity Review',
}

const STATUS_STYLE: Record<PortalAdoptionStatus, string> = {
  NOT_ELIGIBLE: 'bg-white/5 text-white/40 border border-white/10',
  ELIGIBLE: 'bg-white/5 text-white/60 border border-white/10',
  INVITE_PENDING: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  INVITED: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  REMINDER_1_SENT: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  REMINDER_2_SENT: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
  PORTAL_ACTIVE: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20',
  EXCLUDED: 'bg-white/5 text-white/40 border border-white/10',
  IDENTITY_REVIEW_REQUIRED: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
}

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
