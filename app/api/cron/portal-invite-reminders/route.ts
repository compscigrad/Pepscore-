// GET /api/cron/portal-invite-reminders — nudges customers who were invited
// to claim their portal account but haven't yet, at day 3 and day 6 of the
// existing 7-day invite window (see lib/portalInvites.ts's INVITE_EXPIRY_HOURS).
//
// Brought up to the same fail-safe standard as the initial-invite rollout
// cron (see lib/portal/reminderSafety.ts's header comment) after being
// found to have none of the rollout's dry-run/kill-switch/allowlist/cap
// protection -- only its own on/off flag. Layered gates, every one
// independently sufficient to stop a real send:
//   1. CUSTOMER_INVITE_REMINDERS_ENABLED (deploy-time flag)
//   2. CUSTOMER_REMINDER_KILL_SWITCH (env-var emergency stop, no DB needed)
//   3. PortalRolloutSettings.pausedAt (shared with the rollout cron -- an
//      admin pausing communication should stop reminders too, not just new
//      initial invites)
//   4. CUSTOMER_REMINDER_DRY_RUN (defaults ON -- a real send requires the
//      exact string 'false')
//   5. CUSTOMER_REMINDER_ALLOWLIST (when set, restricts real sends to only
//      these recipients even with dry-run off)
//   6. CUSTOMER_REMINDER_MAX_PER_RUN (caps real sends per invocation)
//   7. Test/QA-flagged customers and customers with an open identity-review
//      case are excluded from candidates entirely, same as the initial
//      bulk-invite audience.
//   8. Invite state is re-checked immediately before each send (not just at
//      candidate-selection time) so a claim/revocation mid-run is honored.
// Merging or deploying this file never sends a single real reminder on its
// own; every one of 1-6 defaults to the safe state.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeCompare } from '@/lib/security/safeCompare'
import { isInviteRemindersEnabled } from '@/lib/portalAuth'
import { isPortalRolloutPaused } from '@/lib/portal/rollout'
import { getReminderSafetyConfig, planReminderBatch, type ReminderCandidate } from '@/lib/portal/reminderSafety'
import { getPortalInviteState } from '@/lib/portalInviteState'
import { isInviteDueForReminder, MAX_REMINDERS } from '@/lib/portal/reminderEligibility'
import { sendCategorizedEmail, sendCategorizedSms } from '@/lib/notifications/log'
import { portalInviteReminderSubject, buildPortalInviteReminderHtml, portalInviteSmsBody } from '@/emails/PortalInvite'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  return provided !== null && safeCompare(provided, `Bearer ${secret}`)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isInviteRemindersEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'CUSTOMER_INVITE_REMINDERS_ENABLED is not set' })
  }

  const [dueInvites, openReviewCases, paused] = await Promise.all([
    prisma.customerPortalInvite.findMany({
      where: { claimedAt: null, revokedAt: null, remindersSent: { lt: MAX_REMINDERS } },
      include: { customer: true },
    }),
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' }, select: { customerId: true } }),
    isPortalRolloutPaused(),
  ])
  const conflictCustomerIds = new Set(openReviewCases.map((r) => r.customerId).filter((id): id is string => Boolean(id)))

  const now = Date.now()
  const invitesById = new Map(dueInvites.map((i) => [i.id, i]))
  const dueNow = dueInvites.filter((invite) => isInviteDueForReminder(invite, invite.customer, { now, conflictCustomerIds }))

  const candidates: ReminderCandidate[] = dueNow.map((invite) => ({
    inviteId: invite.id,
    customerId: invite.customerId,
    email: invite.customer.email,
    phone: invite.customer.phone,
  }))

  const config = getReminderSafetyConfig()
  const plan = planReminderBatch(candidates, config, paused)

  if (plan.haltedReason) {
    await prisma.adminAuditLog.create({
      data: {
        action: 'REMINDER_CRON_RUN',
        entity: 'CustomerPortalInvite',
        adminId: 'cron',
        details: { haltedReason: plan.haltedReason, dueCount: dueNow.length },
      },
    })
    return NextResponse.json({ skipped: true, reason: plan.haltedReason })
  }

  let sent = 0
  let dryRunLogged = 0
  let capped = 0
  let blocked = 0
  let failed = 0
  const failures: { customerId: string; inviteId: string; error: string }[] = []

  for (const decision of plan.decisions) {
    if (decision.action === 'DRY_RUN_LOG') {
      dryRunLogged++
      console.log(`[portal-invite-reminders] DRY RUN — would remind customer ${decision.customerId} (invite ${decision.inviteId})`)
      continue
    }
    if (decision.action === 'SKIP_CAPPED') {
      capped++
      continue
    }
    if (decision.action === 'SKIP_NOT_ALLOWLISTED' || decision.action === 'SKIP_NO_CONTACT') {
      blocked++
      continue
    }

    const invite = invitesById.get(decision.inviteId)
    if (!invite) continue
    // Re-check immediately before sending -- claimed/revoked mid-run must
    // never receive a reminder just because it was ACTIVE when first queried.
    if (getPortalInviteState(invite) !== 'ACTIVE') {
      blocked++
      continue
    }

    const { customer } = invite
    const claimUrl = `${APP_URL}/account/claim/${invite.token}`
    const context = { customerId: customer.id, actorType: 'SYSTEM' as const }

    let emailSucceeded = false
    let smsSucceeded = false
    let anyAttempted = false

    if (customer.email) {
      anyAttempted = true
      const result = await sendCategorizedEmail(
        {
          category: 'PORTAL_INVITE_REMINDER',
          to: customer.email,
          subject: portalInviteReminderSubject(),
          html: buildPortalInviteReminderHtml({
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            claimUrl,
            expiresAt: invite.expiresAt,
          }),
        },
        context
      )
      emailSucceeded = result.sent
    }
    if (invite.channel === 'SMS' || invite.channel === 'BOTH') {
      anyAttempted = true
      const result = await sendCategorizedSms('PORTAL_INVITE_REMINDER', customer.phone, portalInviteSmsBody(claimUrl), context)
      smsSucceeded = result.outcome === 'SENT'
    }

    // Only ever mark a reminder delivered if a real attempt actually
    // succeeded -- a provider failure (or an ambiguous non-success outcome)
    // must never falsely increment remindersSent/lastReminderAt. Leaving
    // the counters untouched on failure is the retry mechanism itself: the
    // next cron run re-evaluates this same invite as still due.
    if (emailSucceeded || smsSucceeded) {
      await prisma.customerPortalInvite.update({
        where: { id: invite.id },
        data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
      })
      sent++
    } else if (anyAttempted) {
      failed++
      failures.push({ customerId: customer.id, inviteId: invite.id, error: 'No channel succeeded' })
      console.error(`[portal-invite-reminders] Failed to remind customer ${customer.id} (invite ${invite.id})`)
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      action: 'REMINDER_CRON_RUN',
      entity: 'CustomerPortalInvite',
      adminId: 'cron',
      details: { dryRun: config.dryRun, dueCount: dueNow.length, sent, dryRunLogged, capped, blocked, failed },
    },
  })

  return NextResponse.json({
    dryRun: config.dryRun,
    dueCount: dueNow.length,
    sent,
    dryRunLogged,
    capped,
    blocked,
    failed,
    failures,
  })
}
