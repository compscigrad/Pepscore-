// GET /api/cron/portal-invite-reminders — nudges customers who were invited
// to claim their portal account but haven't yet, at day 3 and day 6 of the
// existing 7-day invite window (see lib/portalInvites.ts's INVITE_EXPIRY_HOURS).
// Gated on CUSTOMER_INVITE_REMINDERS_ENABLED so merging/deploying this route
// never sends anything on its own — matches every other rollout flag in
// lib/portalAuth.ts.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInviteRemindersEnabled } from '@/lib/portalAuth'
import { getPortalInviteState } from '@/lib/portalInviteState'
import { sendCategorizedEmail, sendCategorizedSms } from '@/lib/notifications/log'
import { portalInviteReminderSubject, buildPortalInviteReminderHtml, portalInviteSmsBody } from '@/emails/PortalInvite'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// Reminder cadence within the 7-day invite window — day 3 (first reminder,
// remindersSent 0→1) and day 6 (final reminder, remindersSent 1→2). Capped
// at 2: an invite that's still unclaimed after that just expires normally.
const REMINDER_SCHEDULE_MS = [3 * 24 * 60 * 60 * 1000, 6 * 24 * 60 * 60 * 1000]
const MAX_REMINDERS = REMINDER_SCHEDULE_MS.length

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isInviteRemindersEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'CUSTOMER_INVITE_REMINDERS_ENABLED is not set' })
  }

  const candidates = await prisma.customerPortalInvite.findMany({
    where: { claimedAt: null, revokedAt: null, remindersSent: { lt: MAX_REMINDERS } },
    include: { customer: true },
  })

  let sent = 0
  const now = Date.now()

  for (const invite of candidates) {
    if (getPortalInviteState(invite) !== 'ACTIVE') continue

    const dueAt = invite.createdAt.getTime() + REMINDER_SCHEDULE_MS[invite.remindersSent]
    if (now < dueAt) continue

    const { customer } = invite
    const claimUrl = `${APP_URL}/account/claim/${invite.token}`
    const context = { customerId: customer.id, actorType: 'SYSTEM' as const }

    if (customer.email) {
      await sendCategorizedEmail(
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
    }
    if (invite.channel === 'SMS' || invite.channel === 'BOTH') {
      await sendCategorizedSms('PORTAL_INVITE_REMINDER', customer.phone, portalInviteSmsBody(claimUrl), context)
    }

    await prisma.customerPortalInvite.update({
      where: { id: invite.id },
      data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
    })
    sent++
  }

  return NextResponse.json({ checked: candidates.length, sent })
}
