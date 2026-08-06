// Self-service account resolution — the second and third of the three
// supported onboarding paths (admin invite, self-service claim, new-customer
// self-registration; see lib/portalInvites.ts for the first).
//
// Deliberately NOT a public pre-auth "check if this email exists" endpoint —
// this is only ever called for an already-authenticated Clerk session whose
// primary email Clerk itself has already verified (same trust boundary
// claimPortalInvite() already relies on). That's what makes the flow
// enumeration-safe by construction: there is no code path anywhere that
// takes an unauthenticated email and reports back whether it matched.
//
// Every branch below ends at the exact same transactional Customer.userId
// write claimPortalInvite() uses (email match already proven → upsert User →
// check both link directions → transaction), so admin-invited, self-claimed,
// and self-registered customers are indistinguishable in every other part of
// the app once linked.
import type { Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'

export interface ResolveSelfServiceIdentityInput {
  clerkUserId: string
  // Clerk's own verified primary email — callers must pass this from
  // currentUser().primaryEmailAddress with verification.status === 'verified'
  // checked first, never a client-supplied string. Mirrors
  // ClaimPortalInviteInput.clerkVerifiedEmail's exact contract.
  clerkVerifiedEmail: string
  // Best-effort display name from the Clerk profile, used only when a brand
  // new Customer record has to be created (self-registration) — never used
  // to match against an existing record.
  clerkFirstName?: string | null
  clerkLastName?: string | null
}

export type SelfServiceResolution =
  | { outcome: 'CLAIMED_EXISTING'; customer: Customer }
  | { outcome: 'REGISTERED_NEW'; customer: Customer }
  | { outcome: 'ALREADY_LINKED'; customer: Customer } // idempotent re-entry: this Clerk user already resolved
  | { outcome: 'NEEDS_REVIEW'; reviewCaseId: string }

export async function resolveSelfServiceIdentity(input: ResolveSelfServiceIdentityInput): Promise<SelfServiceResolution> {
  const normalizedEmail = input.clerkVerifiedEmail.trim().toLowerCase()

  const user = await prisma.user.upsert({
    where: { clerkId: input.clerkUserId },
    update: {},
    create: { clerkId: input.clerkUserId, email: input.clerkVerifiedEmail },
  })

  // Idempotent re-entry: this Clerk user already resolved to a Customer on a
  // prior visit (e.g. they refreshed the setup page, or signed in again
  // after already completing self-registration). Never re-run matching.
  const alreadyLinked = await prisma.customer.findFirst({ where: { userId: user.id } })
  if (alreadyLinked) return { outcome: 'ALREADY_LINKED', customer: alreadyLinked }

  const matches = await prisma.customer.findMany({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  })

  if (matches.length === 0) {
    try {
      const customer = await registerNewCustomer(user.id, input)
      return { outcome: 'REGISTERED_NEW', customer }
    } catch (err) {
      if (!(err instanceof SelfServiceConflictError)) throw err
      // Lost a race: a Customer with this email got linked to someone else
      // between our initial read and the transaction. Fall through to
      // review — this is intentionally rare and does not silently succeed.
      const reviewCaseId = await openReviewCase({
        clerkUserId: input.clerkUserId,
        verifiedEmail: normalizedEmail,
        reason: 'ALREADY_LINKED_OTHER_CUSTOMER',
        candidateCustomerIds: [],
      })
      return { outcome: 'NEEDS_REVIEW', reviewCaseId }
    }
  }

  if (matches.length === 1) {
    const candidate = matches[0]

    if (!candidate.userId) {
      try {
        const customer = await claimExistingCustomer(candidate, user.id, input.clerkUserId)
        return { outcome: 'CLAIMED_EXISTING', customer }
      } catch (err) {
        // Lost a race: someone else claimed this Customer between our read
        // and our write. Fall through to review rather than surface a raw
        // error — this is rare (two concurrent claims of the same email)
        // but must never throw an unhandled exception up to the API route.
        if (!(err instanceof SelfServiceConflictError)) throw err
      }
    }

    // Exactly one email match, but it's already linked to a different Clerk
    // user (or a concurrent claim just won the race above) — never silently
    // steal or merge; always a human decision.
    const reviewCaseId = await openReviewCase({
      clerkUserId: input.clerkUserId,
      verifiedEmail: normalizedEmail,
      reason: 'ALREADY_LINKED_OTHER_USER',
      candidateCustomerIds: [candidate.id],
    })
    return { outcome: 'NEEDS_REVIEW', reviewCaseId }
  }

  // More than one Customer row shares this email (duplicates are possible —
  // Customer.email has no uniqueness constraint) — never guess which one is
  // "right." Route to review with every candidate id for the admin to see.
  const reviewCaseId = await openReviewCase({
    clerkUserId: input.clerkUserId,
    verifiedEmail: normalizedEmail,
    reason: 'MULTIPLE_MATCHES',
    candidateCustomerIds: matches.map((m) => m.id),
  })
  return { outcome: 'NEEDS_REVIEW', reviewCaseId }
}

async function claimExistingCustomer(candidate: Customer, userId: string, clerkUserId: string): Promise<Customer> {
  const updated = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two concurrent claim attempts for the
    // same Customer must not both succeed (mirrors claimPortalInvite's race
    // handling, just without a CustomerPortalInvite row to also update).
    const fresh = await tx.customer.findUniqueOrThrow({ where: { id: candidate.id } })
    if (fresh.userId) throw new SelfServiceConflictError('CUSTOMER_ALREADY_LINKED')
    return tx.customer.update({ where: { id: candidate.id }, data: { userId } })
  })

  await recordCustomerActivity({
    customerId: updated.id,
    eventType: 'PORTAL_ACCOUNT_SELF_CLAIMED',
    source: 'SYSTEM',
    userId: clerkUserId,
  })

  return updated
}

async function registerNewCustomer(userId: string, input: ResolveSelfServiceIdentityInput): Promise<Customer> {
  const customer = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction for the same reason as above — a
    // second concurrent request for the same brand-new email must not
    // create two Customer rows.
    const raced = await tx.customer.findFirst({
      where: { email: { equals: input.clerkVerifiedEmail.trim().toLowerCase(), mode: 'insensitive' } },
    })
    if (raced) {
      if (raced.userId) throw new SelfServiceConflictError('CUSTOMER_ALREADY_LINKED')
      return tx.customer.update({ where: { id: raced.id }, data: { userId } })
    }
    return tx.customer.create({
      data: {
        firstName: input.clerkFirstName?.trim() || 'New',
        lastName: input.clerkLastName?.trim() || 'Customer',
        email: input.clerkVerifiedEmail,
        userId,
        status: 'LEAD',
      },
    })
  })

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'PORTAL_ACCOUNT_SELF_REGISTERED',
    source: 'SYSTEM',
    userId: input.clerkUserId,
  })

  return customer
}

interface OpenReviewCaseInput {
  clerkUserId: string
  verifiedEmail: string
  reason: 'MULTIPLE_MATCHES' | 'ALREADY_LINKED_OTHER_USER' | 'ALREADY_LINKED_OTHER_CUSTOMER'
  candidateCustomerIds: string[]
}

async function openReviewCase(input: OpenReviewCaseInput): Promise<string> {
  const reviewCase = await prisma.customerIdentityReviewCase.create({
    data: {
      clerkUserId: input.clerkUserId,
      verifiedEmail: input.verifiedEmail,
      reason: input.reason,
      candidateCustomerIds: input.candidateCustomerIds,
      // Best-effort: attach the first candidate for admin-list display; the
      // full set lives in candidateCustomerIds regardless.
      customerId: input.candidateCustomerIds[0] ?? null,
    },
  })

  if (input.candidateCustomerIds[0]) {
    await recordCustomerActivity({
      customerId: input.candidateCustomerIds[0],
      eventType: 'PORTAL_IDENTITY_CONFLICT_FLAGGED',
      source: 'SYSTEM',
      userId: input.clerkUserId,
    })
  }

  await prisma.notification.create({
    data: {
      type: 'IDENTITY_REVIEW_CASE_OPENED',
      customerId: input.candidateCustomerIds[0] ?? null,
      isNewCustomer: false,
    },
  })

  return reviewCase.id
}

export class SelfServiceConflictError extends Error {
  constructor(public reason: 'CUSTOMER_ALREADY_LINKED') {
    super(`Self-service resolution conflict: ${reason}`)
  }
}
