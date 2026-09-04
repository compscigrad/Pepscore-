// GET /api/cron/birthday-promotions -- runs daily at 13:00 UTC (vercel.json)
// but only actually issues on the first day of a customer's birthday month
// (section 15/20 of the spec this shipped under). Mirrors app/api/cron/
// first-order-offer-reminders/route.ts's safety-gate shape (CRON_SECRET
// auth, an explicit enable flag, per-customer error isolation, audit
// logging) rather than inventing a second cron convention.
//
// 2026-09-04 birthday-journey sprint (B10): registered in vercel.json so
// Vercel invokes this daily -- the invocation itself is a safe no-op
// (returns { skipped: true } immediately) until BIRTHDAY_PROMOTIONS_ENABLED
// is explicitly set to 'true'. That flag, not the scheduling, is the real
// "start sending real discount codes to real customers" decision -- setting
// it is deliberately left as the one remaining owner action (see
// docs/PendingOwnerActions.md) rather than something this sprint flips on
// unilaterally.
//
// Professional Access accounts are never candidates at all (isCustomer
// BirthdayEligible excludes them before a code is ever generated) -- not
// merely filtered out of the send.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeCompare } from '@/lib/security/safeCompare'
import {
  generateBirthdayCode,
  resolveBirthdayIssuanceDay,
  DuplicateBirthdayIssuanceError,
  ProfessionalAccountBirthdayError,
} from '@/lib/pricing/birthdayPromotion'
import { dayInTimeZone, monthInTimeZone, yearInTimeZone } from '@/lib/dateFormat'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { attemptSms } from '@/lib/notifications/bestEffortSms'
import { birthdayPromotionSubject, buildBirthdayPromotionHtml, buildBirthdayPromotionSms } from '@/emails/BirthdayPromotion'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  return provided !== null && safeCompare(provided, `Bearer ${secret}`)
}

function isBirthdayPromotionsEnabled(): boolean {
  return process.env.BIRTHDAY_PROMOTIONS_ENABLED === 'true'
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isBirthdayPromotionsEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'BIRTHDAY_PROMOTIONS_ENABLED is not set' })
  }

  // "Today" for issuance purposes must be Pepscore's own business-calendar
  // day (America/New_York), never raw UTC -- this cron runs on Vercel's
  // server clock, and getUTCMonth()/getUTCDate() would silently issue a
  // day early or late for a customer whose birthday falls near a UTC
  // midnight boundary (2026-09-04 timezone sprint; see lib/dateFormat.ts's
  // header for the exact defect this class of bug produced elsewhere).
  // No per-customer timezone is tracked, so the business fallback is the
  // correct, documented choice (section T16), not a per-customer guess.
  const now = new Date()
  const currentMonth = monthInTimeZone(now)
  const currentYear = yearInTimeZone(now)
  const todayDay = dayInTimeZone(now)

  // Only ever issues on the customer's actual issuance day this cycle
  // (normally the 1st of their birthday month; Feb 29 customers resolve to
  // Feb 28 in a non-leap year) -- a daily cron invocation is a no-op on
  // every other day of the month, matching the "first day of birthday
  // month" business rule literally rather than issuing to the whole
  // month's cohort on day 1 regardless of the leap-day edge case.
  const candidates = await prisma.customer.findMany({
    where: {
      proEligible: false,
      birthdayMonth: currentMonth,
      birthdayDay: { not: null },
      birthdayPromotionCodes: { none: { cycleYear: currentYear } },
    },
    select: { id: true, firstName: true, email: true, phone: true, smsOptedOut: true, birthdayMonth: true, birthdayDay: true },
  })

  const dueToday = candidates.filter((c) => resolveBirthdayIssuanceDay(c.birthdayMonth!, c.birthdayDay!, currentYear) === todayDay)

  let issued = 0
  let emailSent = 0
  let smsSent = 0
  let smsBlocked = 0
  let failed = 0
  const failures: { customerId: string; error: string }[] = []

  for (const customer of dueToday) {
    try {
      const { code, expiresAt } = await generateBirthdayCode(customer.id, currentYear)
      issued++

      if (customer.email) {
        const result = await sendCategorizedEmail(
          {
            category: 'BIRTHDAY_PROMOTION',
            to: customer.email,
            subject: birthdayPromotionSubject(),
            html: buildBirthdayPromotionHtml({ firstName: customer.firstName, code, expiresAt }),
          },
          { customerId: customer.id, actorType: 'SYSTEM' }
        )
        if (result.sent) emailSent++
      }

      // SMS respects consent (smsOptedOut) same as every other customer-
      // facing SMS in this codebase, AND the production-readiness gate
      // (isSmsConfigured, checked inside attemptSms) -- if Twilio isn't
      // live yet, this records SKIPPED_NOT_CONFIGURED rather than silently
      // losing the intent to send: the code is still generated and the
      // email still goes out either way.
      if (customer.phone && !customer.smsOptedOut) {
        const smsResult = await attemptSms(customer.phone, buildBirthdayPromotionSms({ firstName: customer.firstName, code, expiresAt }))
        if (smsResult.outcome === 'SENT') smsSent++
        else smsBlocked++
      }
    } catch (err) {
      failed++
      const message =
        err instanceof ProfessionalAccountBirthdayError || err instanceof DuplicateBirthdayIssuanceError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error'
      failures.push({ customerId: customer.id, error: message })
      console.error(`[birthday-promotions] Failed to issue for customer ${customer.id}:`, err)
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      action: 'BIRTHDAY_PROMOTION_CRON_RUN',
      entity: 'Customer',
      adminId: 'cron',
      details: { candidateCount: dueToday.length, issued, emailSent, smsSent, smsBlocked, failed },
    },
  })

  return NextResponse.json({ candidateCount: dueToday.length, issued, emailSent, smsSent, smsBlocked, failed, failures })
}
