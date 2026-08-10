// Derived (never separately stored) portal-adoption status for every
// Customer -- the single answer to "where is this person in the portal
// onboarding lifecycle" that both the admin customer-list filters and the
// adoption dashboard read. Built entirely from existing authoritative
// records (Customer, CustomerPortalInvite, CustomerIdentityReviewCase,
// PortalRolloutSettings) via the same exclusion rules
// computeEligibleInviteAudience() already uses -- never a second,
// divergent copy of "who's eligible."
import { prisma } from '@/lib/prisma'
import type { Customer, CustomerPortalInvite } from '@prisma/client'
import { computeEligibleInviteAudience, isLeadStage } from '@/lib/portal/rolloutAudience'
import { getPortalInviteState } from '@/lib/portalInviteState'
import { isAutoInvitesEnabled } from '@/lib/portalAuth'
import { isPortalRolloutActive, isPortalRolloutPaused } from '@/lib/portal/rollout'

export type PortalAdoptionStatus =
  | 'NOT_ELIGIBLE' // lifecycle hasn't reached "genuine customer" yet (still a lead/in-progress intake) -- may become eligible later
  | 'ELIGIBLE' // qualifies today; nothing currently configured would auto-invite them
  | 'INVITE_PENDING' // qualifies AND automation is live -- the next cron run will invite them (live-eligibility rollout, see docs/Decisions.md #37)
  | 'INVITED' // active invite sent, no reminder yet
  | 'REMINDER_1_SENT' // active invite, day-3 reminder sent
  | 'REMINDER_2_SENT' // active invite, day-6 (final) reminder sent
  | 'PORTAL_ACTIVE' // Customer.userId is set -- they claimed their account
  | 'EXCLUDED' // structurally blocked: disabled, duplicate contact, test/QA record, or no contact method at all -- won't resolve on its own
  | 'IDENTITY_REVIEW_REQUIRED' // an OPEN CustomerIdentityReviewCase is blocking them

export interface PortalAdoptionEntry {
  customerId: string
  status: PortalAdoptionStatus
  reason: string | null
}

export interface PortalAdoptionOverview {
  entries: PortalAdoptionEntry[]
  byCustomerId: Map<string, PortalAdoptionEntry>
  counts: Record<PortalAdoptionStatus, number>
}

const EMPTY_COUNTS: Record<PortalAdoptionStatus, number> = {
  NOT_ELIGIBLE: 0,
  ELIGIBLE: 0,
  INVITE_PENDING: 0,
  INVITED: 0,
  REMINDER_1_SENT: 0,
  REMINDER_2_SENT: 0,
  PORTAL_ACTIVE: 0,
  EXCLUDED: 0,
  IDENTITY_REVIEW_REQUIRED: 0,
}

type CustomerWithInvites = Customer & { portalInvites: CustomerPortalInvite[] }

export async function computePortalAdoptionOverview(): Promise<PortalAdoptionOverview> {
  const [allCustomers, audience, openReviewCases, autoInvitesEnabled, rolloutActive, rolloutPaused] = await Promise.all([
    prisma.customer.findMany({ include: { portalInvites: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
    computeEligibleInviteAudience(),
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' }, select: { customerId: true } }),
    Promise.resolve(isAutoInvitesEnabled()),
    isPortalRolloutActive(),
    isPortalRolloutPaused(),
  ])

  const conflictCustomerIds = new Set(openReviewCases.map((r) => r.customerId).filter((id): id is string => Boolean(id)))
  const duplicateIds = new Set(audience.duplicateFlagged.map((c) => c.id))
  const testDataIds = new Set(audience.testDataFlagged.map((c) => c.id))
  const missingContactIds = new Set(audience.missingContact.map((c) => c.id))
  const eligibleIds = new Set(audience.eligible.map((c) => c.id))
  // The rollout cron now runs off live eligibility every invocation, not a
  // frozen activation-time snapshot (docs/Decisions.md #37) -- so any
  // currently-eligible customer will be picked up on the very next run
  // once automation is on, active, and not paused. No per-customer
  // snapshot-membership check needed anymore.
  const autoInviteImminent = autoInvitesEnabled && rolloutActive && !rolloutPaused

  const entries: PortalAdoptionEntry[] = allCustomers.map((customer) => classify(customer))
  const counts = { ...EMPTY_COUNTS }
  for (const entry of entries) counts[entry.status]++

  return { entries, byCustomerId: new Map(entries.map((e) => [e.customerId, e])), counts }

  // Mirrors computeEligibleInviteAudience()'s own pipeline order exactly
  // (missingContact -> duplicate -> testData -> leadStage -> conflict) so a
  // customer who happens to match more than one exclusion reason is
  // classified the same way in both places -- e.g. a duplicate-flagged
  // customer who also has an open conflict case is EXCLUDED here, not
  // IDENTITY_REVIEW_REQUIRED, because the audience computation never even
  // reaches the conflict check for a customer already filtered out earlier.
  function classify(customer: CustomerWithInvites): PortalAdoptionEntry {
    if (customer.userId) {
      // portalAccessDisabled on an already-linked account is a separate,
      // admin-reversible kill switch, not a lifecycle/eligibility state --
      // still counts as PORTAL_ACTIVE (they did claim it), matching
      // getPortalReadinessStatus()'s own DISABLED-is-a-flavor-of-claimed
      // treatment. Portal Access section on the customer profile already
      // surfaces portalAccessDisabled directly for the admin to act on.
      return { customerId: customer.id, status: 'PORTAL_ACTIVE', reason: customer.portalAccessDisabled ? 'Portal access disabled by admin' : null }
    }

    // portalAccessDisabled is ordinarily set on an already-claimed
    // customer (see the branch above), but nothing prevents an admin from
    // setting it on one who never claimed at all -- computeEligibleInviteAudience()'s
    // base query already filters these out of every bucket (unclaimed AND
    // not disabled), so without this explicit check they'd silently fall
    // through to the generic NOT_ELIGIBLE default below instead of
    // reporting the real reason.
    if (customer.portalAccessDisabled) {
      return { customerId: customer.id, status: 'EXCLUDED', reason: 'Portal access disabled by admin' }
    }

    if (missingContactIds.has(customer.id)) {
      return { customerId: customer.id, status: 'EXCLUDED', reason: 'No email or phone on file' }
    }
    if (duplicateIds.has(customer.id)) {
      return { customerId: customer.id, status: 'EXCLUDED', reason: 'Duplicate email/phone with another customer record' }
    }
    if (testDataIds.has(customer.id)) {
      return { customerId: customer.id, status: 'EXCLUDED', reason: 'Matches a test/QA data pattern' }
    }
    if (isLeadStage(customer)) {
      return {
        customerId: customer.id,
        status: 'NOT_ELIGIBLE',
        reason: `No invoice issued yet (lead status: ${customer.leadStatus}) — mark Converted to include before their first invoice`,
      }
    }
    if (conflictCustomerIds.has(customer.id)) {
      return { customerId: customer.id, status: 'IDENTITY_REVIEW_REQUIRED', reason: 'Open identity-review case' }
    }

    const mostRecentInvite = customer.portalInvites[0] ?? null
    if (mostRecentInvite && getPortalInviteState(mostRecentInvite) === 'ACTIVE') {
      if (mostRecentInvite.remindersSent >= 2) return { customerId: customer.id, status: 'REMINDER_2_SENT', reason: null }
      if (mostRecentInvite.remindersSent === 1) return { customerId: customer.id, status: 'REMINDER_1_SENT', reason: null }
      return { customerId: customer.id, status: 'INVITED', reason: null }
    }

    // No active invite (never invited, or their invite expired/was
    // revoked -- computeEligibleInviteAudience() already treats both as
    // re-eligible, the existing approved re-invitation policy, not
    // reinvented here) and not otherwise excluded above.
    if (eligibleIds.has(customer.id)) {
      if (autoInviteImminent) {
        return { customerId: customer.id, status: 'INVITE_PENDING', reason: null }
      }
      return { customerId: customer.id, status: 'ELIGIBLE', reason: null }
    }

    // Shouldn't normally be reached (every unclaimed, non-excluded,
    // non-lead-stage customer with contact info is in audience.eligible by
    // construction) -- falls back to NOT_ELIGIBLE rather than asserting,
    // matching this module's "never guess, degrade to the conservative
    // state" convention.
    return { customerId: customer.id, status: 'NOT_ELIGIBLE', reason: null }
  }
}

// The "Run Portal Adoption Audit" report shape -- same computation the
// scheduled reconciliation job would use (a future PR's job, not built
// yet), exposed here as a read-only admin report so the owner can answer
// "does every eligible customer have a portal account or valid invitation"
// at any time without anything being sent. Reusing computePortalAdoptionOverview()
// rather than a second query pass keeps this report and the per-customer
// statuses structurally unable to disagree.
export interface PortalAdoptionAuditReport {
  customersReviewed: number
  portalActive: number
  invitationPending: number
  eligibleNotYetInvited: number
  reminderOutstanding: number // has an active invite awaiting claim, at any reminder stage (INVITED + REMINDER_1_SENT + REMINDER_2_SENT)
  identityReviewRequired: number
  excludedTotal: number
  excludedByReason: { reason: string; count: number }[]
  notEligible: number
  // Not a separate adoption status today: Customer.smsOptedOut only
  // suppresses the SMS channel for that one customer (enforced inside
  // sendCategorizedSms), it never blocks an email invite or excludes them
  // from the audience entirely -- so there is currently no "customer-wide
  // suppressed" state to report. Always 0; kept as an explicit field
  // (rather than omitted) so the report shape matches what was asked for
  // and this isn't silently missing.
  suppressed: number
}

export function summarizeAdoptionAudit(overview: PortalAdoptionOverview): PortalAdoptionAuditReport {
  const excludedReasonCounts = new Map<string, number>()
  for (const entry of overview.entries) {
    if (entry.status !== 'EXCLUDED') continue
    const reason = entry.reason ?? 'Other'
    excludedReasonCounts.set(reason, (excludedReasonCounts.get(reason) ?? 0) + 1)
  }

  return {
    customersReviewed: overview.entries.length,
    portalActive: overview.counts.PORTAL_ACTIVE,
    invitationPending: overview.counts.INVITE_PENDING,
    eligibleNotYetInvited: overview.counts.ELIGIBLE,
    reminderOutstanding: overview.counts.INVITED + overview.counts.REMINDER_1_SENT + overview.counts.REMINDER_2_SENT,
    identityReviewRequired: overview.counts.IDENTITY_REVIEW_REQUIRED,
    excludedTotal: overview.counts.EXCLUDED,
    excludedByReason: Array.from(excludedReasonCounts, ([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    notEligible: overview.counts.NOT_ELIGIBLE,
    suppressed: 0,
  }
}
