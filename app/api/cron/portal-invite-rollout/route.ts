// GET /api/cron/portal-invite-rollout — the automated bulk-invitation send.
// Runs off LIVE eligibility (computeEligibleInviteAudience(), recomputed
// every invocation), not a one-time frozen batch — see docs/Decisions.md
// #37 for why this changed from the original snapshot-only design.
// Layered gates, every one independently sufficient to stop a real send —
// see lib/portal/rolloutSafety.ts's header comment for why this exists:
//   1. CUSTOMER_AUTO_INVITES_ENABLED (deploy-time flag)
//   2. PortalRolloutSettings.activatedAt (runtime admin action -- an
//      ONGOING "automated invites are running" state, not a one-time
//      batch approval; see #37)
//   3. CUSTOMER_ROLLOUT_KILL_SWITCH (env-var emergency stop, no DB needed)
//   4. PortalRolloutSettings.pausedAt (admin-facing pause, DB-driven)
//   5. CUSTOMER_ROLLOUT_DRY_RUN (defaults ON — a real send requires the
//      exact string 'false', not just the absence of an opt-in)
//   6. CUSTOMER_ROLLOUT_TEST_ALLOWLIST (when set, restricts real sends to
//      only these recipients even with dry-run off)
//   7. Every one of computeEligibleInviteAudience()'s own exclusion rules
//      (claimed, disabled, missing contact, duplicate, test/QA, lead-stage,
//      identity conflict, already-invited) -- recomputed fresh every run,
//      so a customer who stops qualifying between runs is dropped
//      automatically, and one who starts qualifying is picked up without
//      any admin action.
//   8. generatePortalInvite()'s own idempotency guards (an existing active
//      invite is reused, not duplicated; an already-linked customer throws)
//      -- the real duplicate-send protection, independent of anything in
//      this route.
// Merging or deploying this file never sends a single real invitation on
// its own; every one of 1-6 defaults to the safe state.
import { NextRequest, NextResponse } from 'next/server'
import { isAutoInvitesEnabled, isSmsInvitesEnabled } from '@/lib/portalAuth'
import { isPortalRolloutActive, isPortalRolloutPaused } from '@/lib/portal/rollout'
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

  const [paused, audience] = await Promise.all([isPortalRolloutPaused(), computeEligibleInviteAudience()])
  // Live eligibility every run -- see the header comment and
  // docs/Decisions.md #37. Not scoped to the historical activation
  // snapshot; a customer who becomes eligible after activation is picked
  // up on the very next run, same as one who was eligible on day one.
  const candidates = audience.eligible

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
    candidatesThisRun: candidates.length,
    dryRunLogged,
    blocked,
    sent,
    failed: failures.length,
    failures,
  })
}
