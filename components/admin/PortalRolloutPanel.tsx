// The one-button rollout activation control — deliberately the only place
// in the admin UI that can ever start the automated bulk-invitation cron.
// Two-step confirm (not the single-click pattern the rest of this app
// uses for Resend/Revoke/etc.) because this is the one action in the whole
// Customer Identity Platform sprint that's genuinely irreversible in
// spirit: once activated, real customers start receiving real invitations
// on the next cron run — subject to the dry-run/kill-switch/allowlist
// safeguards surfaced below. Activating is an ONGOING decision, not a
// one-time batch approval: the cron recomputes live eligibility on every
// run, so new customers who qualify later are invited automatically too,
// without a second activation — see lib/portal/rollout.ts,
// lib/portal/rolloutSafety.ts, and docs/Decisions.md #37.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline } from '@/components/invoices/theme'

export interface PortalRolloutSettingsView {
  activatedAt: string | null
  activatedBy: string | null
  pausedAt: string | null
  pausedBy: string | null
  audienceSnapshotSize: number | null
}

export function PortalRolloutPanel({
  settings,
  eligibleCount,
  readyToActivate,
  dryRun,
  killSwitchActive,
  allowlistSize,
}: {
  settings: PortalRolloutSettingsView
  eligibleCount: number
  readyToActivate: boolean
  dryRun: boolean
  killSwitchActive: boolean
  allowlistSize: number
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function act(action: 'activate' | 'pause' | 'resume', successMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/portal-rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Failed to ${action} rollout`)
      toast.success(successMessage)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} rollout`)
    } finally {
      setSubmitting(false)
      setConfirming(false)
    }
  }

  if (settings.activatedAt) {
    return (
      <div className={`${card} p-6 space-y-4`}>
        <div>
          <h3 className={sectionHeading}>Rollout Activated</h3>
          <p className={`text-sm ${mutedText} mt-2`}>
            Activated {new Date(settings.activatedAt).toLocaleString()} by {settings.activatedBy ?? 'unknown'} — at that moment,{' '}
            {settings.audienceSnapshotSize ?? 0} customer{settings.audienceSnapshotSize === 1 ? '' : 's'} were eligible. Automation
            is ongoing: the cron recomputes who currently qualifies on every run, so customers who become eligible later are
            invited automatically too, subject to the safety gates below.
          </p>
        </div>

        <SafetyStatus dryRun={dryRun} killSwitchActive={killSwitchActive} allowlistSize={allowlistSize} />

        {settings.pausedAt ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
            <p className="text-sm text-white">
              Paused {new Date(settings.pausedAt).toLocaleString()} by {settings.pausedBy ?? 'unknown'}. The cron will not
              send anything until resumed.
            </p>
            <button type="button" className={`${pillPrimary} px-5 py-2.5`} disabled={submitting} onClick={() => act('resume', 'Rollout resumed')}>
              Resume
            </button>
          </div>
        ) : (
          <button type="button" className={`${pillOutline} px-5 py-2.5`} disabled={submitting} onClick={() => act('pause', 'Rollout paused')}>
            Pause
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`${card} p-6 space-y-4`}>
      <div>
        <h3 className={sectionHeading}>Activate Automated Rollout</h3>
        <p className={`text-sm ${mutedText} mt-2`}>
          Not yet activated. Activating turns on ongoing automated invitations: the {eligibleCount} customer
          {eligibleCount === 1 ? '' : 's'} eligible right now will be invited on the next run, and any customer who becomes
          eligible later will be invited automatically too — this is not a one-time batch. This cannot be meaningfully undone
          once customers have actually been contacted.
        </p>
      </div>

      <SafetyStatus dryRun={dryRun} killSwitchActive={killSwitchActive} allowlistSize={allowlistSize} />

      {!confirming ? (
        <button
          type="button"
          className={`${pillPrimary} px-5 py-2.5`}
          disabled={!readyToActivate}
          onClick={() => setConfirming(true)}
        >
          Activate Rollout
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <p className="text-sm text-white">
            This starts ongoing automated invitations, beginning with {eligibleCount} real customer{eligibleCount === 1 ? '' : 's'}{' '}
            eligible right now, and continuing automatically as new customers qualify.{' '}
            {dryRun
              ? 'CUSTOMER_ROLLOUT_DRY_RUN is on, so the cron will only log what it would send — no real messages yet.'
              : 'CUSTOMER_ROLLOUT_DRY_RUN is off — the cron WILL send real messages on its next run.'}{' '}
            Are you sure?
          </p>
          <div className="flex gap-3">
            <button type="button" className={`${pillPrimary} px-5 py-2.5`} disabled={submitting} onClick={() => act('activate', 'Rollout activated')}>
              {submitting ? 'Activating…' : 'Yes, activate rollout'}
            </button>
            <button
              type="button"
              className={`${pillOutline} px-5 py-2.5`}
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!readyToActivate && (
        <p className="text-sm text-amber-400/80">
          Activation is disabled until CUSTOMER_AUTO_INVITES_ENABLED is set — the cron checks this flag independently of
          this button, so activating early would have no effect.
        </p>
      )}
    </div>
  )
}

function SafetyStatus({ dryRun, killSwitchActive, allowlistSize }: { dryRun: boolean; killSwitchActive: boolean; allowlistSize: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-1.5">
      <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Current Safety State</p>
      <p className="text-sm text-white">
        Dry run: <span className={dryRun ? 'text-emerald-400' : 'text-red-400 font-bold'}>{dryRun ? 'ON (safe — nothing sent)' : 'OFF (real sends authorized)'}</span>
      </p>
      <p className="text-sm text-white">
        Kill switch: <span className={killSwitchActive ? 'text-red-400 font-bold' : mutedText}>{killSwitchActive ? 'ACTIVE (all sends blocked)' : 'off'}</span>
      </p>
      <p className="text-sm text-white">
        Test allowlist: <span className={mutedText}>{allowlistSize > 0 ? `${allowlistSize} recipient(s) — only these can receive a real send` : 'unrestricted (no allowlist set)'}</span>
      </p>
    </div>
  )
}
