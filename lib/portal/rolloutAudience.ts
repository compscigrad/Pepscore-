// Computes who is safe to include in the automated bulk-invitation rollout
// — read-only, side-effect-free, callable as many times as needed to preview
// the audience before anything is actually sent. This is the exact data the
// final launch-readiness checkpoint presents, and what
// app/api/cron/portal-invite-rollout/route.ts consults before sending.
//
// Deliberately conservative: anything ambiguous is excluded from the
// eligible list and counted separately rather than guessed at, mirroring
// findPossibleDuplicateCustomers()'s "surface, never auto-merge" principle.
import type { Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPortalReadinessStatus } from '@/lib/portal/readiness'
import { digitsOnly } from '@/lib/notifications/phoneMatch'
import { looksLikeTestData } from '@/lib/customers/linkageBackfill'

export interface RolloutAudience {
  eligible: Customer[]
  missingContact: Customer[]
  duplicateFlagged: Customer[]
  alreadyInvited: Customer[]
  alreadyClaimed: number
  conflictReview: number
  // Surfaced for admin review, same "flag, never auto-decide" principle as
  // duplicateFlagged/conflictReview -- looksLikeTestData() is a heuristic
  // (name/email pattern match), so a false positive is possible; excluding
  // these from `eligible` by default means the failure mode is "an admin
  // has to manually re-include a real customer," never "a test record gets
  // a real invitation."
  testDataFlagged: Customer[]
  // See isLeadStage()'s comment -- a Customer who has never had an invoice
  // issued to them (still LEAD/INTAKE_SENT/INTAKE_COMPLETED) is excluded
  // from the bulk-invite audience the same conservative way.
  leadStageFlagged: Customer[]
}

// A Customer's status is recomputed from their real invoice history (see
// lib/customers/status.ts's computeCustomerStatus): LEAD/INTAKE_SENT/
// INTAKE_COMPLETED all mean "no invoice has ever been issued to this
// person" -- a lead-capture or in-progress intake record, not someone who
// has actually transacted. Verified against real production data
// (2026-08-08 audit): 4 of the then-14 "eligible" customers had never had
// an invoice issued at all. A portal account only makes sense for someone
// with something to actually view there (invoices, orders); auto-inviting
// a bare lead is exactly the "do not assume every raw lead should
// automatically receive portal credentials" case the rollout spec calls
// out -- see docs/Decisions.md #35. These are excluded the same
// conservative way duplicates/test data are: surfaced for admin review,
// never silently dropped from the report.
const LEAD_STAGE_STATUSES: Customer['status'][] = ['LEAD', 'INTAKE_SENT', 'INTAKE_COMPLETED']

export function isLeadStage(customer: Pick<Customer, 'status'>): boolean {
  return LEAD_STAGE_STATUSES.includes(customer.status)
}

export function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

// Last-10-digits (US/CA subscriber number), matching the same convention
// lib/notifications/phoneMatch.ts's phoneNumbersMatch() already uses for
// Twilio opt-out matching -- otherwise "(305) 984-2899" and
// "+1-305-984-2899" (the same real number) normalize to different strings
// and a genuine duplicate goes undetected.
export function normalizePhone(phone: string | null): string | null {
  const digits = phone ? digitsOnly(phone) : ''
  const tail = digits.slice(-10)
  return tail.length === 10 ? tail : null
}

// Pure split -- no DB, unit-testable directly. Anyone with neither email
// nor phone can never receive an invite of any channel.
export function classifyByContactInfo<T extends Pick<Customer, 'id' | 'email' | 'phone'>>(
  customers: T[]
): { missingContact: T[]; withContact: T[] } {
  const missingContact: T[] = []
  const withContact: T[] = []
  for (const customer of customers) {
    if (!customer.email && !customer.phone) missingContact.push(customer)
    else withContact.push(customer)
  }
  return { missingContact, withContact }
}

// Pure grouping -- no DB. Group by normalized email/phone to find any
// customer sharing contact info with another row — Customer.email/.phone
// have no uniqueness constraint, so this is a real possibility, not a
// hypothetical. Returns the ids to exclude, never guesses which of the two
// (or more) rows is the "real" one.
export function findDuplicateContactCustomerIds<T extends Pick<Customer, 'id' | 'email' | 'phone'>>(
  customers: T[]
): Set<string> {
  const byEmail = new Map<string, T[]>()
  const byPhone = new Map<string, T[]>()
  for (const customer of customers) {
    const email = normalizeEmail(customer.email)
    const phone = normalizePhone(customer.phone)
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), customer])
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), customer])
  }
  const duplicateIds = new Set<string>()
  for (const group of byEmail.values()) if (group.length > 1) group.forEach((c) => duplicateIds.add(c.id))
  for (const group of byPhone.values()) if (group.length > 1) group.forEach((c) => duplicateIds.add(c.id))
  return duplicateIds
}

export async function computeEligibleInviteAudience(): Promise<RolloutAudience> {
  const [unclaimed, claimedCount] = await Promise.all([
    prisma.customer.findMany({ where: { userId: null, portalAccessDisabled: false } }),
    prisma.customer.count({ where: { userId: { not: null } } }),
  ])

  const { missingContact, withContact } = classifyByContactInfo(unclaimed)

  const duplicateIds = findDuplicateContactCustomerIds(withContact)
  const duplicateFlagged = withContact.filter((c) => duplicateIds.has(c.id))
  const nonDuplicate = withContact.filter((c) => !duplicateIds.has(c.id))

  const testDataFlagged = nonDuplicate.filter((c) => looksLikeTestData(`${c.firstName} ${c.lastName}`.trim(), c.email))
  const testDataIds = new Set(testDataFlagged.map((c) => c.id))
  const nonTestData = nonDuplicate.filter((c) => !testDataIds.has(c.id))

  const leadStageFlagged = nonTestData.filter(isLeadStage)
  const leadStageIds = new Set(leadStageFlagged.map((c) => c.id))
  const nonLeadStage = nonTestData.filter((c) => !leadStageIds.has(c.id))

  const [openReviewCases, statuses] = await Promise.all([
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' } }),
    Promise.all(nonLeadStage.map(async (c) => ({ customer: c, status: await getPortalReadinessStatus(c) }))),
  ])
  const conflictReviewCustomerIds = new Set(
    openReviewCases.map((r) => r.customerId).filter((id): id is string => Boolean(id))
  )

  const eligible: Customer[] = []
  const alreadyInvited: Customer[] = []
  for (const { customer, status } of statuses) {
    if (conflictReviewCustomerIds.has(customer.id)) continue // counted separately below
    if (status === 'INVITE_SENT') alreadyInvited.push(customer)
    else if (status === 'UNCLAIMED_ELIGIBLE' || status === 'INVITE_EXPIRED' || status === 'INVITE_REVOKED') eligible.push(customer)
  }

  return {
    eligible,
    missingContact,
    duplicateFlagged,
    alreadyInvited,
    alreadyClaimed: claimedCount,
    conflictReview: openReviewCases.length,
    testDataFlagged,
    leadStageFlagged,
  }
}
