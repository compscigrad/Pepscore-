// Launch-readiness report + the one-button rollout activation control —
// the exact checkpoint required before any real customer is contacted by
// the automated bulk-invitation system. Every number here is computed live
// (lib/portal/rolloutAudience.ts), never cached or precomputed, so this
// page is always safe to reload right before activating.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
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
import { computePortalAdoptionOverview, summarizeAdoptionAudit, computePortalAdoptionRates } from '@/lib/portal/adoptionStatus'
import { getRecentPortalDeliveryIssues, summarizeRepeatedFailures } from '@/lib/portal/deliveryIssues'
import { prisma } from '@/lib/prisma'
import { PortalRolloutPanel } from '@/components/admin/PortalRolloutPanel'
import { ReminderPreviewTable } from '@/components/admin/ReminderPreviewTable'
import { card, mutedText, sectionHeading, divider } from '@/components/invoices/theme'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

const FLAG_LABEL: Record<string, string> = {
  CUSTOMER_SELF_REGISTRATION_ENABLED: 'Self-service claim/registration',
  CUSTOMER_AUTO_INVITES_ENABLED: 'Automated bulk invitations',
  CUSTOMER_SMS_INVITES_ENABLED: 'SMS channel for invitations',
  CUSTOMER_INVITE_REMINDERS_ENABLED: 'Invite reminder sequence',
}

export default async function PortalRolloutPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [audience, settings, reminderPreview, adoptionOverview, deliveryIssues] = await Promise.all([
    computeEligibleInviteAudience(),
    getPortalRolloutSettings(),
    getReminderPreview(),
    computePortalAdoptionOverview(),
    getRecentPortalDeliveryIssues(),
  ])
  const adoptionAudit = summarizeAdoptionAudit(adoptionOverview)
  const adoptionRates = await computePortalAdoptionRates(adoptionAudit)
  const repeatedFailures = summarizeRepeatedFailures(deliveryIssues)
  const repeatedFailureCustomers =
    repeatedFailures.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: repeatedFailures.map((r) => r.customerId) } }, select: { id: true, firstName: true, lastName: true } })
      : []
  const repeatedFailureNameById = new Map(repeatedFailureCustomers.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]))

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
      <div className="max-w-[1000px] mx-auto">
        <AdminPageHeader
          title="Portal Rollout Launch Readiness"
          subtitle="Customer Identity Platform — automated invitation rollout · Pepscore Lab"
          actions={
            <>
              <Link
                href="/admin/customers/portal-invite"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                Bulk Portal Invite →
              </Link>
              <Link
                href="/admin/invoices"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                ← Invoices
              </Link>
            </>
          }
        />

        <div className="space-y-6">
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
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t ${divider}`}>
            <RateStat label="Activation rate" value={adoptionRates.activationRate} detail={`${adoptionAudit.portalActive} of ${adoptionAudit.customersReviewed} customers`} />
            <RateStat label="Pending adoption" value={adoptionRates.pendingAdoptionRate} detail="Still moving through the pipeline" />
            <RateStat
              label="Invite conversion rate"
              value={adoptionRates.inviteConversionRate}
              detail={
                adoptionRates.everInvitedCount > 0
                  ? `${adoptionRates.everInvitedNowActiveCount} of ${adoptionRates.everInvitedCount} ever invited`
                  : 'No one has been invited yet'
              }
            />
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

        {deliveryIssues.length > 0 && (
          <div className={`${card} p-6 border-amber-400/30 bg-amber-400/[0.03]`}>
            <h3 className={sectionHeading}>Recent Delivery Issues</h3>
            <p className={`text-sm ${mutedText} mt-1 mb-4`}>
              Failed sends from the last {deliveryIssues.length} cron run{deliveryIssues.length === 1 ? '' : 's'} that had at least one failure. A failed send never marks an
              invitation/reminder as delivered — the affected customer stays eligible and is retried automatically on the next run.
            </p>
            {repeatedFailures.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>Failed on 2+ separate runs — may need manual attention</p>
                {repeatedFailures.map((f) => (
                  <div key={f.customerId} className="flex justify-between text-sm gap-3">
                    <Link href={`/admin/customers/${f.customerId}`} className="text-gold-light hover:underline">
                      {repeatedFailureNameById.get(f.customerId) ?? f.customerId}
                    </Link>
                    <span className="text-white/60 text-right">
                      {f.count}× — {f.lastError}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className={`pt-3 border-t ${divider} space-y-1.5`}>
              <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>Recent runs with failures</p>
              {deliveryIssues.map((issue) => (
                <div key={issue.id} className="flex justify-between text-sm">
                  <span className="text-white/70">
                    {issue.cron === 'ROLLOUT' ? 'Rollout' : 'Reminder'} — {issue.occurredAt.toLocaleString()}
                  </span>
                  <span className="text-white font-medium">{issue.failedCount} failed</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
              Still a lead or in-progress intake, and not yet marked Converted — no invoice has ever been issued to this customer. A legitimate customer can exist before their first invoice: mark them Converted on their profile&rsquo;s CRM status to include them here without waiting for an invoice, or invite manually if appropriate.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {audience.leadStageFlagged.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-white">{`${c.firstName} ${c.lastName}`.trim()}</span>
                  <span className="flex items-center gap-2">
                    <span className={mutedText}>{c.email ?? c.phone ?? '—'}</span>
                    <span className="text-[10px] font-bold tracking-wide uppercase text-white/40 border border-white/15 rounded-full px-2 py-0.5">
                      {c.leadStatus}
                    </span>
                  </span>
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

function RateStat({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div>
      <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>{label}</p>
      <p className="font-heading text-2xl font-bold mt-1 text-white">{value === null ? '—' : `${Math.round(value * 100)}%`}</p>
      <p className={`text-xs ${mutedText} mt-0.5`}>{detail}</p>
    </div>
  )
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
