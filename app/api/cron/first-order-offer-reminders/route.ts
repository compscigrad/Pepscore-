// GET /api/cron/first-order-offer-reminders — nudges a customer who claimed
// a first-order offer (PromotionCampaign system) but hasn't yet redeemed it,
// at day 2 and day 5 after the claim (see lib/promotions/
// firstOrderReminderEligibility.ts). Built 2026-08-12 as part of the AOAI
// lead-capture/conversion sprint, deliberately mirroring
// app/api/cron/portal-invite-reminders/route.ts's exact safety-gate
// structure rather than inventing a second reminder engine:
//   1. FIRST_ORDER_OFFER_REMINDERS_ENABLED (deploy-time flag)
//   2. CUSTOMER_REMINDER_KILL_SWITCH (shared emergency stop, no DB needed)
//   3. PortalRolloutSettings.pausedAt (an admin pausing communication stops
//      this reminder too, same as every other customer-facing cron)
//   4. CUSTOMER_REMINDER_DRY_RUN (defaults ON -- a real send requires the
//      exact string 'false')
//   5. CUSTOMER_REMINDER_ALLOWLIST (when set, restricts real sends to only
//      these recipients even with dry-run off)
//   6. CUSTOMER_REMINDER_MAX_PER_RUN (caps real sends per invocation)
//   7. Test-data customers and customers with an open identity-review case
//      are excluded from candidates entirely.
//   8. Redemption state is re-checked immediately before each send (not
//      just at candidate-selection time) so a purchase mid-run is honored.
// This route is NOT registered in vercel.json's crons array -- merging or
// deploying this file never sends a single real reminder on its own, and it
// stays that way until the owner explicitly authorizes scheduling it (see
// docs/PendingOwnerActions.md).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeCompare } from '@/lib/security/safeCompare'
import { isPortalRolloutPaused } from '@/lib/portal/rollout'
import { getReminderSafetyConfig, planReminderBatch, type ReminderCandidate } from '@/lib/portal/reminderSafety'
import { isClaimDueForFirstOrderReminder, MAX_FIRST_ORDER_REMINDERS } from '@/lib/promotions/firstOrderReminderEligibility'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { firstOrderOfferReminderSubject, buildFirstOrderOfferReminderHtml } from '@/emails/FirstOrderOfferReminder'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  return provided !== null && safeCompare(provided, `Bearer ${secret}`)
}

function isFirstOrderOfferRemindersEnabled(): boolean {
  return process.env.FIRST_ORDER_OFFER_REMINDERS_ENABLED === 'true'
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isFirstOrderOfferRemindersEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'FIRST_ORDER_OFFER_REMINDERS_ENABLED is not set' })
  }

  const [dueClaims, openReviewCases, paused] = await Promise.all([
    prisma.firstOrderOfferClaim.findMany({
      where: { redeemedAt: null, remindersSent: { lt: MAX_FIRST_ORDER_REMINDERS } },
      include: { customer: true, promotionCode: true, campaign: true },
    }),
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' }, select: { customerId: true } }),
    isPortalRolloutPaused(),
  ])
  const conflictCustomerIds = new Set(openReviewCases.map((r) => r.customerId).filter((id): id is string => Boolean(id)))

  const now = Date.now()
  const claimsById = new Map(dueClaims.map((c) => [c.id, c]))
  const dueNow = dueClaims.filter((claim) => isClaimDueForFirstOrderReminder(claim, claim.customer, { now, conflictCustomerIds }))

  const candidates: ReminderCandidate[] = dueNow.map((claim) => ({
    inviteId: claim.id,
    customerId: claim.customerId,
    email: claim.customer.email,
    phone: claim.customer.phone,
  }))

  const config = getReminderSafetyConfig()
  const plan = planReminderBatch(candidates, config, paused)

  if (plan.haltedReason) {
    await prisma.adminAuditLog.create({
      data: {
        action: 'REMINDER_CRON_RUN',
        entity: 'FirstOrderOfferClaim',
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
  const failures: { customerId: string; claimId: string; error: string }[] = []

  for (const decision of plan.decisions) {
    if (decision.action === 'DRY_RUN_LOG') {
      dryRunLogged++
      console.log(`[first-order-offer-reminders] DRY RUN — would remind customer ${decision.customerId} (claim ${decision.inviteId})`)
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

    const claim = claimsById.get(decision.inviteId)
    if (!claim) continue
    // Re-check immediately before sending -- a purchase completed mid-run
    // must never receive a reminder just because it was unredeemed when
    // first queried.
    const fresh = await prisma.firstOrderOfferClaim.findUnique({ where: { id: claim.id }, select: { redeemedAt: true } })
    if (!fresh || fresh.redeemedAt) {
      blocked++
      continue
    }

    const { customer, promotionCode, campaign } = claim
    if (!customer.email) {
      blocked++
      continue
    }

    const discountType = promotionCode?.discountType ?? campaign?.discountType
    const discountValue = promotionCode?.discountValue ?? campaign?.discountValue
    if (!discountType || discountValue === undefined) {
      blocked++
      continue
    }

    const isFinalReminder = claim.remindersSent + 1 >= MAX_FIRST_ORDER_REMINDERS
    const props = {
      firstName: customer.firstName,
      publicTitle: campaign?.publicTitle ?? 'Your first-order offer',
      discountType,
      discountValue,
      code: promotionCode?.code ?? null,
      isFinalReminder,
    }
    const context = { customerId: customer.id, actorType: 'SYSTEM' as const }

    const result = await sendCategorizedEmail(
      {
        category: 'FIRST_ORDER_OFFER_REMINDER',
        to: customer.email,
        subject: firstOrderOfferReminderSubject(props),
        html: buildFirstOrderOfferReminderHtml(props),
      },
      context
    )

    // Only ever mark a reminder delivered if the send actually succeeded --
    // a provider failure must never falsely increment remindersSent/
    // lastReminderAt. Leaving the counters untouched on failure is the
    // retry mechanism itself: the next cron run re-evaluates this same
    // claim as still due.
    if (result.sent) {
      await prisma.firstOrderOfferClaim.update({
        where: { id: claim.id },
        data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
      })
      sent++
    } else {
      failed++
      failures.push({ customerId: customer.id, claimId: claim.id, error: 'Email send failed' })
      console.error(`[first-order-offer-reminders] Failed to remind customer ${customer.id} (claim ${claim.id})`)
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      action: 'REMINDER_CRON_RUN',
      entity: 'FirstOrderOfferClaim',
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
