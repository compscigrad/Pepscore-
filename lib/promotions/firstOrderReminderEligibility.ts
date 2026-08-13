// Pure first-purchase reminder eligibility logic (2026-08-12 AOAI lead-
// capture/conversion sprint) -- same day-N cadence + explicit-exclusion
// pattern as lib/portal/reminderEligibility.ts's classifyReminderStage(),
// applied to FirstOrderOfferClaim instead of CustomerPortalInvite. Kept
// as its own pure module (no DB access) so the cron's scheduling logic
// is unit-testable without a database, matching this codebase's
// established split for reminder cadences.
import { looksLikeTestData } from '@/lib/customers/linkageBackfill'

// Day 2 (first nudge, remindersSent 0->1) and day 5 (final, 1->2) after
// claiming the offer. Capped at 2 -- someone still not purchased after
// that gets no further reminders from this cron.
export const FIRST_ORDER_REMINDER_SCHEDULE_MS = [2 * 24 * 60 * 60 * 1000, 5 * 24 * 60 * 60 * 1000]
export const MAX_FIRST_ORDER_REMINDERS = FIRST_ORDER_REMINDER_SCHEDULE_MS.length

export interface ReminderEligibilityClaim {
  customerId: string
  claimedAt: Date
  remindersSent: number
  redeemedAt: Date | null
}

export interface ReminderEligibilityCustomer {
  firstName: string
  lastName: string
  email: string | null
  smsOptedOut: boolean
}

export type FirstOrderReminderStage =
  | 'DAY_2_DUE'
  | 'DAY_5_DUE'
  | 'NOT_YET_DUE'
  | 'MAX_REMINDERS_REACHED'
  | 'EXCLUDED_TEST_DATA'
  | 'EXCLUDED_ALREADY_PURCHASED' // redeemedAt set -- the reminder's entire purpose is satisfied
  | 'EXCLUDED_IDENTITY_CONFLICT'

export function classifyFirstOrderReminderStage(
  claim: ReminderEligibilityClaim,
  customer: ReminderEligibilityCustomer,
  opts: { now: number; conflictCustomerIds: Set<string> }
): FirstOrderReminderStage {
  // Stop condition (sprint section 38): converted customers are never
  // bothered again, regardless of how the conversion was recorded.
  if (claim.redeemedAt) return 'EXCLUDED_ALREADY_PURCHASED'
  if (opts.conflictCustomerIds.has(claim.customerId)) return 'EXCLUDED_IDENTITY_CONFLICT'
  if (looksLikeTestData(`${customer.firstName} ${customer.lastName}`.trim(), customer.email)) return 'EXCLUDED_TEST_DATA'
  if (claim.remindersSent >= MAX_FIRST_ORDER_REMINDERS) return 'MAX_REMINDERS_REACHED'

  const dueAt = claim.claimedAt.getTime() + FIRST_ORDER_REMINDER_SCHEDULE_MS[claim.remindersSent]
  if (opts.now < dueAt) return 'NOT_YET_DUE'
  return claim.remindersSent === 0 ? 'DAY_2_DUE' : 'DAY_5_DUE'
}

export function isClaimDueForFirstOrderReminder(
  claim: ReminderEligibilityClaim,
  customer: ReminderEligibilityCustomer,
  opts: { now: number; conflictCustomerIds: Set<string> }
): boolean {
  const stage = classifyFirstOrderReminderStage(claim, customer, opts)
  return stage === 'DAY_2_DUE' || stage === 'DAY_5_DUE'
}
