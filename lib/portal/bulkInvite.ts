// Admin-initiated bulk portal invitation (2026-08-19 lead-capture/
// conversion engine addendum, section 8-11) -- lets an admin invite a
// batch of EXISTING direct-sale customers to activate online/portal
// access, distinct from the automated-rollout cron
// (app/api/cron/portal-invite-rollout/route.ts). Deliberately reuses,
// never duplicates:
//   - computePortalAdoptionOverview() for per-customer eligibility
//     classification (the exact same ELIGIBLE/PORTAL_ACTIVE/INVITED/
//     EXCLUDED/IDENTITY_REVIEW_REQUIRED states the automated system uses)
//   - planRolloutBatch() + getRolloutSafetyConfig() for the SEND/
//     DRY_RUN_LOG/SKIP decision -- an admin-initiated bulk send is
//     governed by the exact same CUSTOMER_ROLLOUT_DRY_RUN/KILL_SWITCH/
//     TEST_ALLOWLIST env vars as the automated cron, so a real send from
//     this feature is structurally impossible without the same explicit
//     owner-set production configuration, not a parallel unguarded path.
//   - generatePortalInvite() for the actual invite creation + send
import { prisma } from '@/lib/prisma'
import { computePortalAdoptionOverview, type PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'
import { getRolloutSafetyConfig, planRolloutBatch } from '@/lib/portal/rolloutSafety'
import { isPortalRolloutPaused } from '@/lib/portal/rollout'
import { generatePortalInvite, PortalInviteError } from '@/lib/portalInvites'

export interface BulkInvitePreviewRow {
  customerId: string
  name: string
  email: string | null
  status: PortalAdoptionStatus
  reason: string | null
  eligibleToInvite: boolean
}

// Read-only preview -- section 11's explicit requirement that Admin sees
// a breakdown ("Eligible: X, Already active: X, ...") before any real
// send is authorized. Never sends anything.
export async function previewBulkInvite(customerIds: string[]): Promise<BulkInvitePreviewRow[]> {
  const [customers, overview] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    computePortalAdoptionOverview(),
  ])
  return customers.map((c) => {
    const entry = overview.byCustomerId.get(c.id)
    const status = entry?.status ?? 'NOT_ELIGIBLE'
    return {
      customerId: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      status,
      reason: entry?.reason ?? null,
      // Only a customer the adoption engine itself calls ELIGIBLE or
      // INVITE_PENDING is a real candidate -- every other status
      // (PORTAL_ACTIVE, INVITED, EXCLUDED, IDENTITY_REVIEW_REQUIRED,
      // NOT_ELIGIBLE) is never re-invited by this action, matching
      // section 10's "do not repeatedly invite already-active customers."
      eligibleToInvite: status === 'ELIGIBLE' || status === 'INVITE_PENDING',
    }
  })
}

export type BulkInviteAction = 'SENT' | 'DRY_RUN_LOGGED' | 'SKIPPED_NOT_ELIGIBLE' | 'SKIPPED_NOT_ALLOWLISTED' | 'SKIPPED_NO_EMAIL' | 'FAILED'

export interface BulkInviteResultRow {
  customerId: string
  action: BulkInviteAction
  error?: string
}

export interface BulkInviteRunResult {
  haltedReason: 'KILL_SWITCH' | 'PAUSED' | null
  dryRun: boolean
  sent: number
  dryRunLogged: number
  skippedNotEligible: number
  skippedNotAllowlisted: number
  skippedNoEmail: number
  failed: number
  results: BulkInviteResultRow[]
}

// The real (or dry-run) send. actorId is a real admin Clerk user id --
// every generatePortalInvite() call is attributed to them, same audit
// trail as the existing single-customer "Invite to Portal" action.
export async function runBulkInvite(customerIds: string[], actorId: string): Promise<BulkInviteRunResult> {
  const [preview, paused] = await Promise.all([previewBulkInvite(customerIds), isPortalRolloutPaused()])
  const config = getRolloutSafetyConfig()

  const eligible = preview.filter((row) => row.eligibleToInvite)
  const notEligible = preview.filter((row) => !row.eligibleToInvite)

  const plan = planRolloutBatch(
    eligible.map((row) => ({ id: row.customerId, email: row.email })),
    config,
    paused
  )

  const results: BulkInviteResultRow[] = notEligible.map((row) => ({ customerId: row.customerId, action: 'SKIPPED_NOT_ELIGIBLE' }))

  if (plan.haltedReason) {
    return {
      haltedReason: plan.haltedReason,
      dryRun: config.dryRun,
      sent: 0,
      dryRunLogged: 0,
      skippedNotEligible: notEligible.length,
      skippedNotAllowlisted: 0,
      skippedNoEmail: 0,
      failed: 0,
      results,
    }
  }

  let sent = 0
  let dryRunLogged = 0
  let skippedNotAllowlisted = 0
  let skippedNoEmail = 0
  let failed = 0

  for (const decision of plan.decisions) {
    if (decision.action === 'DRY_RUN_LOG') {
      dryRunLogged++
      results.push({ customerId: decision.customerId, action: 'DRY_RUN_LOGGED' })
      continue
    }
    if (decision.action === 'SKIP_NOT_ALLOWLISTED') {
      skippedNotAllowlisted++
      results.push({ customerId: decision.customerId, action: 'SKIPPED_NOT_ALLOWLISTED' })
      continue
    }
    if (decision.action === 'SKIP_NO_EMAIL') {
      skippedNoEmail++
      results.push({ customerId: decision.customerId, action: 'SKIPPED_NO_EMAIL' })
      continue
    }

    try {
      await generatePortalInvite({ customerId: decision.customerId, createdBy: actorId, channel: 'EMAIL', source: 'ADMIN' })
      sent++
      results.push({ customerId: decision.customerId, action: 'SENT' })
    } catch (err) {
      failed++
      results.push({
        customerId: decision.customerId,
        action: 'FAILED',
        error: err instanceof PortalInviteError ? err.message : 'Failed to create invite',
      })
    }
  }

  return {
    haltedReason: null,
    dryRun: config.dryRun,
    sent,
    dryRunLogged,
    skippedNotEligible: notEligible.length,
    skippedNotAllowlisted,
    skippedNoEmail,
    failed,
    results,
  }
}
