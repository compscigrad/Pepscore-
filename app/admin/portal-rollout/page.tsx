// Launch-readiness report + the one-button rollout activation control —
// the exact checkpoint required before any real customer is contacted by
// the automated bulk-invitation system. Every number here is computed live
// (lib/portal/rolloutAudience.ts), never cached or precomputed, so this
// page is always safe to reload right before activating.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { computeEligibleInviteAudience } from '@/lib/portal/rolloutAudience'
import { getPortalRolloutSettings } from '@/lib/portal/rollout'
import { isAutoInvitesEnabled, isSmsInvitesEnabled, isInviteRemindersEnabled, isSelfRegistrationEnabled } from '@/lib/portalAuth'
import { isSmsConfigured } from '@/lib/notifications/bestEffortSms'
import { FROM_EMAIL } from '@/lib/resend'
import { getRolloutSafetyConfig } from '@/lib/portal/rolloutSafety'
import { getReminderSafetyConfig } from '@/lib/portal/reminderSafety'
import { getReminderPreview } from '@/lib/portal/reminderPreview'
import { computePortalAdoptionOverview, summarizeAdoptionAudit } from '@/lib/portal/adoptionStatus'
import { PortalRolloutPanel } from '@/components/admin/PortalRolloutPanel'
import { ReminderPreviewTable } from '@/components/admin/ReminderPreviewTable'
import { card, mutedText, sectionHeading, divider } from '@/components/invoices/theme'

const FLAG_LABEL: Record<string, string> = {
  CUSTOMER_SELF_REGISTRATION_ENABLED: 'Self-service claim/registration',
  CUSTOMER_AUTO_INVITES_ENABLED: 'Automated bulk invitations',
  CUSTOMER_SMS_INVITES_ENABLED: 'SMS channel for invitations',
  CUSTOMER_INVITE_REMINDERS_ENABLED: 'Invite reminder sequence',
}

export default async function PortalRolloutPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const [audience, settings, reminderPreview, adoptionOverview] = await Promise.all([
    computeEligibleInviteAudience(),
    getPortalRolloutSettings(),
    getReminderPreview(),
    computePortalAdoptionOverview(),
  ])
  const adoptionAudit = summarizeAdoptionAudit(adoptionOverview)

  const resendDomainVerified = FROM_EMAIL !== 'onboarding@resend.dev'
  const smsConfigured = isSmsConfigured()
  const flags = {
    CUSTOMER_SELF_REGISTRATION_ENABLED: isSelfRegistrationEnabled(),
    CUSTOMER_AUTO_INVITES_ENABLED: isAutoInvitesEnabled(),
    CUSTOMER_SMS_INVITES_ENABLED: isSmsInvitesEnabled(),
    CUSTOMER_INVITE_REMINDERS_ENABLED: isInviteRemindersEnabled(),
  }

  const readyToActivate = flags.CUSTOMER_AUTO_INVITES_ENABLED
  const safety = getRolloutSafetyConfig()
  const reminderSafety = getReminderSafetyConfig()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Portal Rollout Launch Readiness</h1>
            <p className={`text-sm ${mutedText} mt-1`}>Customer Identity Platform — automated invitation rollout · Pepscore Lab</p>
          </div>
          <Link
            href="/admin/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Invoices
          </Link>
        </div>

        <div className={`${card} p-6`}>
          <h3 className={sectionHeading}>Portal Adoption Audit</h3>
          <p className={`text-sm ${mutedText} mt-1 mb-4`}>
            Live, read-only answer to &ldquo;does every eligible customer have a portal account or a valid invitation&rdquo; — recomputed on every page load. Nothing here sends anything; real invitations only ever go out through the Activate control below.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Stat label="Customers reviewed" value={adoptionAudit.customersReviewed} />
            <Stat label="Portal active" value={adoptionAudit.portalActive} />
            <Stat label="Invitation pending" value={adoptionAudit.invitationPending} />
            <Stat label="Eligible, not yet invited" value={adoptionAudit.eligibleNotYetInvited} highlight />
            <Stat label="Reminder outstanding" value={adoptionAudit.reminderOutstanding} />
            <Stat label="Identity review required" value={adoptionAudit.identityReviewRequired} />
            <Stat label="Not yet eligible" value={adoptionAudit.notEligible} />
            <Stat label="Excluded (total)" value={adoptionAudit.excludedTotal} />
          </div>
          {adoptionAudit.excludedByReason.length > 0 && (
            <div className={`pt-4 border-t ${divider} space-y-1.5`}>
              <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText} mb-2`}>Excluded, by reason</p>
              {adoptionAudit.excludedByReason.map((r) => (
                <div key={r.reason} className="flex justify-between text-sm">
                  <span className="text-white/70">{r.reason}</span>
                  <span className="text-white font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${card} p-6`}>
          <h3 className={sectionHeading}>Eligible Audience</h3>
          <p className={`text-sm ${mutedText} mt-1 mb-4`}>
            No invitation has been sent to anyone in this report — these are counts only, computed live and never cached.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="Eligible now" value={audience.eligible.length} highlight />
            <Stat label="Already invited" value={audience.alreadyInvited.length} />
            <Stat label="Already claimed" value={audience.alreadyClaimed} />
            <Stat label="Missing contact info" value={audience.missingContact.length} />
            <Stat label="Duplicate-flagged (excluded)" value={audience.duplicateFlagged.length} />
            <Stat
              label="Identity conflicts (excluded)"
              value={audience.conflictReview}
              href={audience.conflictReview > 0 ? '/admin/identity-review' : undefined}
            />
            <Stat label="Test/QA-flagged (excluded)" value={audience.testDataFlagged.length} />
            <Stat label="No invoice yet (excluded)" value={audience.leadStageFlagged.length} />
          </div>
        </div>

        <div className={`${card} p-6`}>
          <h3 className={sectionHeading}>Delivery Readiness</h3>
          <div className={`mt-4 divide-y ${divider}`}>
            <ReadinessRow
              label="Resend domain verified (pepscorelab.com)"
              ready={resendDomainVerified}
              detail={resendDomainVerified ? FROM_EMAIL : 'Falling back to the Resend sandbox sender — owner action, not code'}
            />
            <ReadinessRow
              label="Twilio SMS configured"
              ready={smsConfigured}
              detail={smsConfigured ? 'Account SID, auth token, and phone number are all set' : 'TWILIO_* env vars are unset — owner action, not code'}
            />
          </div>
        </div>

        <div className={`${card} p-6`}>
          <h3 className={sectionHeading}>Feature Flags</h3>
          <div className={`mt-4 divide-y ${divider}`}>
            {Object.entries(flags).map(([key, enabled]) => (
              <ReadinessRow key={key} label={FLAG_LABEL[key]} ready={enabled} detail={enabled ? 'Enabled' : `${key} is unset (default off)`} />
            ))}
          </div>
        </div>

        <div className={`${card} p-6`}>
          <h3 className={sectionHeading}>Reminder Readiness</h3>
          <p className={`text-sm ${mutedText} mt-1 mb-4`}>
            Day-3/Day-6 reminders for customers who haven&rsquo;t claimed their invite yet — same layered safety gates as the initial rollout. No reminder has been sent from this report.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <Stat label="Eligible Day-3 reminders" value={reminderPreview.eligibleDay3} highlight />
            <Stat label="Eligible Day-6 reminders" value={reminderPreview.eligibleDay6} highlight />
            <Stat label="Recipient cap (per run)" value={reminderSafety.maxPerRun} />
          </div>
          <div className={`divide-y ${divider}`}>
            <ReadinessRow
              label="Reminder feature enabled"
              ready={flags.CUSTOMER_INVITE_REMINDERS_ENABLED}
              detail={flags.CUSTOMER_INVITE_REMINDERS_ENABLED ? 'Enabled' : 'CUSTOMER_INVITE_REMINDERS_ENABLED is unset (default off)'}
            />
            <ReadinessRow
              label="Reminder dry-run"
              ready={reminderSafety.dryRun}
              detail={reminderSafety.dryRun ? 'On (safe) — no real reminder will be sent' : 'Off — real reminders will send if otherwise eligible'}
            />
            <ReadinessRow
              label="Reminder kill switch"
              ready={!reminderSafety.killSwitch}
              detail={reminderSafety.killSwitch ? 'ACTIVE — every reminder run is halted before evaluating any candidate' : 'Inactive'}
            />
            <ReadinessRow
              label="Reminder allowlist"
              ready={reminderSafety.allowlist.size === 0}
              detail={reminderSafety.allowlist.size > 0 ? `Restricted to ${reminderSafety.allowlist.size} allowlisted recipient(s)` : 'Unrestricted (no allowlist configured)'}
            />
          </div>
        </div>

        {reminderPreview.entries.length > 0 && <ReminderPreviewTable entries={reminderPreview.entries} />}

        {audience.eligible.length > 0 && (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>Eligible Customers ({audience.eligible.length})</h3>
            <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
              {audience.eligible.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-white">{`${c.firstName} ${c.lastName}`.trim()}</span>
                  <span className={mutedText}>{c.email ?? c.phone ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {audience.testDataFlagged.length > 0 && (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>Test/QA-Flagged — Excluded, Review Recommended ({audience.testDataFlagged.length})</h3>
            <p className={`text-sm ${mutedText} mt-1 mb-4`}>
              Name or email matched a test-data pattern (e.g. &ldquo;Test&rdquo;, &ldquo;QA&rdquo;, or a placeholder email domain). Heuristic — verify before manually inviting if any of these are real.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {audience.testDataFlagged.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-white">{`${c.firstName} ${c.lastName}`.trim()}</span>
                  <span className={mutedText}>{c.email ?? c.phone ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {audience.leadStageFlagged.length > 0 && (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>No Invoice Yet — Excluded ({audience.leadStageFlagged.length})</h3>
            <p className={`text-sm ${mutedText} mt-1 mb-4`}>
              Still a lead or in-progress intake — no invoice has ever been issued to this customer. A portal account isn&rsquo;t useful until there&rsquo;s something real to show there; invite manually once they&rsquo;ve actually transacted, if appropriate.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {audience.leadStageFlagged.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-white">{`${c.firstName} ${c.lastName}`.trim()}</span>
                  <span className={mutedText}>{c.email ?? c.phone ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <PortalRolloutPanel
          settings={{
            activatedAt: settings?.activatedAt?.toISOString() ?? null,
            activatedBy: settings?.activatedBy ?? null,
            pausedAt: settings?.pausedAt?.toISOString() ?? null,
            pausedBy: settings?.pausedBy ?? null,
            audienceSnapshotSize: Array.isArray(settings?.audienceSnapshot) ? settings.audienceSnapshot.length : null,
          }}
          eligibleCount={audience.eligible.length}
          readyToActivate={readyToActivate}
          dryRun={safety.dryRun}
          killSwitchActive={safety.killSwitch}
          allowlistSize={safety.allowlist.size}
        />
      </div>
    </main>
  )
}

function Stat({ label, value, highlight, href }: { label: string; value: number; highlight?: boolean; href?: string }) {
  const body = (
    <>
      <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>{label}</p>
      <p className={`font-heading text-2xl font-bold mt-1 ${highlight ? 'text-gold' : 'text-white'}`}>{value}</p>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {body}
      </Link>
    )
  }
  return <div>{body}</div>
}

function ReadinessRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className={`text-xs ${mutedText} mt-0.5`}>{detail}</p>
      </div>
      <span
        className={`shrink-0 ml-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${
          ready ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/50'
        }`}
      >
        {ready ? 'Ready' : 'Not Ready'}
      </span>
    </div>
  )
}
