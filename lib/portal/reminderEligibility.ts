// Pure reminder-eligibility logic, extracted from
// app/api/cron/portal-invite-reminders/route.ts so the day-3/day-6
// scheduling + exclusion rules (still-active state, not a test/QA record,
// no open identity conflict) are unit-testable without a database --
// matching the isEligibleForAutoArchive / rolloutAudience pure-logic split
// used elsewhere in this codebase. classifyReminderStage() is the single
// source of truth; isInviteDueForReminder() is a thin boolean view of it
// for the cron, and the same classification backs the admin preview
// (lib/portal/reminderPreview.ts) so the two can never disagree.
import { getPortalInviteState, type PortalInviteState } from '@/lib/portalInviteState'
import { looksLikeTestData } from '@/lib/customers/linkageBackfill'

// Day 3 (first reminder, remindersSent 0→1) and day 6 (final, 1→2) of the
// 7-day invite window. Capped at 2 -- an invite still unclaimed after that
// just expires normally rather than getting a third nudge.
export const REMINDER_SCHEDULE_MS = [3 * 24 * 60 * 60 * 1000, 6 * 24 * 60 * 60 * 1000]
export const MAX_REMINDERS = REMINDER_SCHEDULE_MS.length

export interface ReminderEligibilityInvite {
  customerId: string
  createdAt: Date
  remindersSent: number
  claimedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}

export interface ReminderEligibilityCustomer {
  firstName: string
  lastName: string
  email: string | null
}

export type ReminderStage =
  | 'DAY_3_DUE'
  | 'DAY_6_DUE'
  | 'NOT_YET_DUE'
  | 'MAX_REMINDERS_REACHED'
  | 'EXCLUDED_TEST_DATA'
  | 'EXCLUDED_IDENTITY_CONFLICT'
  | 'EXCLUDED_NOT_ACTIVE' // claimed, revoked, or expired -- see PortalInviteState

export function classifyReminderStage(
  invite: ReminderEligibilityInvite,
  customer: ReminderEligibilityCustomer,
  opts: { now: number; conflictCustomerIds: Set<string> }
): ReminderStage {
  const state: PortalInviteState = getPortalInviteState(invite)
  if (state !== 'ACTIVE') return 'EXCLUDED_NOT_ACTIVE'

  if (opts.conflictCustomerIds.has(invite.customerId)) return 'EXCLUDED_IDENTITY_CONFLICT'
  if (looksLikeTestData(`${customer.firstName} ${customer.lastName}`.trim(), customer.email)) return 'EXCLUDED_TEST_DATA'
  if (invite.remindersSent >= MAX_REMINDERS) return 'MAX_REMINDERS_REACHED'

  const dueAt = invite.createdAt.getTime() + REMINDER_SCHEDULE_MS[invite.remindersSent]
  if (opts.now < dueAt) return 'NOT_YET_DUE'
  return invite.remindersSent === 0 ? 'DAY_3_DUE' : 'DAY_6_DUE'
}

export function isInviteDueForReminder(
  invite: ReminderEligibilityInvite,
  customer: ReminderEligibilityCustomer,
  opts: { now: number; conflictCustomerIds: Set<string> }
): boolean {
  const stage = classifyReminderStage(invite, customer, opts)
  return stage === 'DAY_3_DUE' || stage === 'DAY_6_DUE'
}
