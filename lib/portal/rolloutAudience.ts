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

export interface RolloutAudience {
  eligible: Customer[]
  missingContact: Customer[]
  duplicateFlagged: Customer[]
  alreadyInvited: Customer[]
  alreadyClaimed: number
  conflictReview: number
}

function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

function normalizePhone(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '')
  return digits ? digits : null
}

export async function computeEligibleInviteAudience(): Promise<RolloutAudience> {
  const [unclaimed, claimedCount] = await Promise.all([
    prisma.customer.findMany({ where: { userId: null, portalAccessDisabled: false } }),
    prisma.customer.count({ where: { userId: { not: null } } }),
  ])

  const missingContact: Customer[] = []
  const withContact: Customer[] = []
  for (const customer of unclaimed) {
    if (!customer.email && !customer.phone) missingContact.push(customer)
    else withContact.push(customer)
  }

  // Group by normalized email/phone to find any customer sharing contact
  // info with another row — Customer.email/.phone have no uniqueness
  // constraint, so this is a real possibility, not a hypothetical.
  const byEmail = new Map<string, Customer[]>()
  const byPhone = new Map<string, Customer[]>()
  for (const customer of withContact) {
    const email = normalizeEmail(customer.email)
    const phone = normalizePhone(customer.phone)
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), customer])
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), customer])
  }
  const duplicateIds = new Set<string>()
  for (const group of byEmail.values()) if (group.length > 1) group.forEach((c) => duplicateIds.add(c.id))
  for (const group of byPhone.values()) if (group.length > 1) group.forEach((c) => duplicateIds.add(c.id))

  const duplicateFlagged = withContact.filter((c) => duplicateIds.has(c.id))
  const nonDuplicate = withContact.filter((c) => !duplicateIds.has(c.id))

  const [openReviewCases, statuses] = await Promise.all([
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' } }),
    Promise.all(nonDuplicate.map(async (c) => ({ customer: c, status: await getPortalReadinessStatus(c) }))),
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
  }
}
