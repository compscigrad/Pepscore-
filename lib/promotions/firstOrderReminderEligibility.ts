// Pure first-purchase reminder eligibility logic (2026-08-12 AOAI lead-
// capture/conversion sprint; refactored 2026-08-19 lead-capture/conversion
// engine to accept an admin-configurable schedule instead of a hardcoded
// day-2/day-5 constant -- see AcquisitionPopupSettings.reminderIntervalsHours,
// section 16: "these timings must be ADMIN CONFIGURABLE... not hardcoded
// permanently"). Same day-N cadence + explicit-exclusion pattern as
// lib/portal/reminderEligibility.ts's classifyReminderStage(), applied to
// FirstOrderOfferClaim instead of CustomerPortalInvite. Kept as its own
// pure module (no DB access) so the cron's scheduling logic is unit-
// testable without a database, matching this codebase's established split
// for reminder cadences.
import { looksLikeTestData } from '@/lib/customers/linkageBackfill'

// Conceptual default cadence (section 16): 24h / 3 days / 7 days after
// claiming. Read from AcquisitionPopupSettings.reminderIntervalsHours in
// production -- this constant is only the fallback/seed value for a fresh
// settings row and for tests, never read directly by the cron.
export const DEFAULT_FIRST_ORDER_REMINDER_SCHEDULE_HOURS = [24, 72, 168]

export function hoursToScheduleMs(hours: number[]): number[] {
  return hours.map((h) => h * 60 * 60 * 1000)
}

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
  | 'REMINDER_DUE'
  | 'NOT_YET_DUE'
  | 'MAX_REMINDERS_REACHED'
  | 'EXCLUDED_TEST_DATA'
  | 'EXCLUDED_ALREADY_PURCHASED' // redeemedAt set -- the reminder's entire purpose is satisfied
  | 'EXCLUDED_IDENTITY_CONFLICT'

export interface ReminderEligibilityOptions {
  now: number
  conflictCustomerIds: Set<string>
  // The schedule this claim should follow, in milliseconds after
  // claimedAt, one entry per reminder (index 0 = first reminder,
  // index 1 = second, ...). Length determines the max-reminders cap --
  // there is no separate "max reminders" setting to keep in sync.
  scheduleMs: number[]
}

export function classifyFirstOrderReminderStage(
  claim: ReminderEligibilityClaim,
  customer: ReminderEligibilityCustomer,
  opts: ReminderEligibilityOptions
): FirstOrderReminderStage {
  // Stop condition (sprint section 38 / 2026-08-19 section 17): converted
  // customers are never bothered again, regardless of how the conversion
  // was recorded.
  if (claim.redeemedAt) return 'EXCLUDED_ALREADY_PURCHASED'
  if (opts.conflictCustomerIds.has(claim.customerId)) return 'EXCLUDED_IDENTITY_CONFLICT'
  if (looksLikeTestData(`${customer.firstName} ${customer.lastName}`.trim(), customer.email)) return 'EXCLUDED_TEST_DATA'
  if (claim.remindersSent >= opts.scheduleMs.length) return 'MAX_REMINDERS_REACHED'

  const dueAt = claim.claimedAt.getTime() + opts.scheduleMs[claim.remindersSent]
  if (opts.now < dueAt) return 'NOT_YET_DUE'
  return 'REMINDER_DUE'
}

export function isClaimDueForFirstOrderReminder(
  claim: ReminderEligibilityClaim,
  customer: ReminderEligibilityCustomer,
  opts: ReminderEligibilityOptions
): boolean {
  return classifyFirstOrderReminderStage(claim, customer, opts) === 'REMINDER_DUE'
}
