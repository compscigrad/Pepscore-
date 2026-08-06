// GET /api/cron/portal-invite-rollout — the automated bulk-invitation send.
// Layered gates, every one independently sufficient to stop a real send —
// see lib/portal/rolloutSafety.ts's header comment for why this exists:
//   1. CUSTOMER_AUTO_INVITES_ENABLED (deploy-time flag)
//   2. PortalRolloutSettings.activatedAt (runtime admin action)
//   3. CUSTOMER_ROLLOUT_KILL_SWITCH (env-var emergency stop, no DB needed)
//   4. PortalRolloutSettings.pausedAt (admin-facing pause, DB-driven)
//   5. CUSTOMER_ROLLOUT_DRY_RUN (defaults ON — a real send requires the
//      exact string 'false', not just the absence of an opt-in)
//   6. CUSTOMER_ROLLOUT_TEST_ALLOWLIST (when set, restricts real sends to
//      only these recipients even with dry-run off)
//   7. The audience snapshot captured at activation — only ever sends to
//      customers who were both in that approved snapshot AND are still
//      currently eligible right now.
// Merging or deploying this file never sends a single real invitation on
// its own; every one of 1-6 defaults to the safe state.
import { NextRequest, NextResponse } from 'next/server'
import { isAutoInvitesEnabled, isSmsInvitesEnabled } from '@/lib/portalAuth'
import { isPortalRolloutActive, isPortalRolloutPaused, getAudienceSnapshotIds } from '@/lib/portal/rollout'
import { computeEligibleInviteAudience } from '@/lib/portal/rolloutAudience'
import { getRolloutSafetyConfig, planRolloutBatch } from '@/lib/portal/rolloutSafety'
import { generatePortalInvite, PortalInviteError } from '@/lib/portalInvites'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAutoInvitesEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'CUSTOMER_AUTO_INVITES_ENABLED is not set' })
  }
  if (!(await isPortalRolloutActive())) {
    return NextResponse.json({ skipped: true, reason: 'PortalRolloutSettings has not been activated by an admin yet' })
  }

  const [snapshotIds, paused, audience] = await Promise.all([
    getAudienceSnapshotIds(),
    isPortalRolloutPaused(),
    computeEligibleInviteAudience(),
  ])
  const snapshotSet = new Set(snapshotIds ?? [])
  // Only ever a customer approved in the original snapshot AND still
  // currently eligible — never a candidate that only appeared later.
  const candidates = audience.eligible.filter((c) => snapshotSet.has(c.id))

  const config = getRolloutSafetyConfig()
  const plan = planRolloutBatch(candidates, config, paused)

  if (plan.haltedReason) {
    return NextResponse.json({ skipped: true, reason: plan.haltedReason })
  }

  const smsEnabled = isSmsInvitesEnabled()
  const customersById = new Map(candidates.map((c) => [c.id, c]))

  let sent = 0
  let dryRunLogged = 0
  let blocked = 0
  const failures: { customerId: string; error: string }[] = []

  for (const decision of plan.decisions) {
    if (decision.action === 'DRY_RUN_LOG') {
      dryRunLogged++
      console.log(`[portal-invite-rollout] DRY RUN — would invite customer ${decision.customerId} (${decision.email ?? 'no email'})`)
      continue
    }
    if (decision.action === 'SKIP_NOT_ALLOWLISTED' || decision.action === 'SKIP_NO_EMAIL') {
      blocked++
      continue
    }

    const customer = customersById.get(decision.customerId)
    if (!customer) continue
    try {
      await generatePortalInvite({
        customerId: customer.id,
        createdBy: 'system-auto-rollout',
        channel: smsEnabled && customer.phone ? 'BOTH' : 'EMAIL',
        source: 'AUTO_ROLLOUT',
      })
      sent++
    } catch (err) {
      const message = err instanceof PortalInviteError ? err.message : err instanceof Error ? err.message : 'Unknown error'
      failures.push({ customerId: customer.id, error: message })
      console.error(`[portal-invite-rollout] Failed to invite customer ${customer.id}:`, message)
    }
  }

  return NextResponse.json({
    dryRun: config.dryRun,
    eligibleTotal: audience.eligible.length,
    snapshotSize: snapshotSet.size,
    candidatesThisRun: candidates.length,
    dryRunLogged,
    blocked,
    sent,
    failed: failures.length,
    failures,
  })
}
