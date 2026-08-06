// Admin resolution for CustomerIdentityReviewCase rows — the only place a
// review case ever leaves OPEN status. Deliberately narrow in scope:
//
// - MULTIPLE_MATCHES: the admin picks which of the candidate Customer rows
//   is correct, and this links it — safe, because every candidate was
//   already confirmed unclaimed (userId null) at the time selfServiceResolve
//   flagged it, and we re-verify that here too.
// - ALREADY_LINKED_OTHER_USER / ALREADY_LINKED_OTHER_CUSTOMER: these can
//   only be dismissed here, never approved directly. Resolving them means
//   taking an identity link away from whoever currently holds it, which is
//   already a real, audited admin action — the existing Unlink control on
//   PortalAccessSection (app/api/admin/customers/[id]/portal-invite's PATCH
//   'unlink'). An admin who decides that's the right fix uses that control
//   first; the next time the waiting Clerk user signs in, resolution runs
//   again and succeeds cleanly on its own. Building a second "reassign a
//   link" pathway here would duplicate that already-reviewed action with
//   weaker auditing.
import type { CustomerIdentityReviewCase } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'

export class ReviewCaseError extends Error {}

export async function approveIdentityReviewCase(
  reviewCaseId: string,
  chosenCustomerId: string,
  adminUserId: string
): Promise<CustomerIdentityReviewCase> {
  const reviewCase = await prisma.customerIdentityReviewCase.findUniqueOrThrow({ where: { id: reviewCaseId } })
  if (reviewCase.status !== 'OPEN') {
    throw new ReviewCaseError('This review case has already been resolved.')
  }
  if (reviewCase.reason !== 'MULTIPLE_MATCHES') {
    throw new ReviewCaseError('This case can only be dismissed here — use Unlink on the other customer first, then have the customer try again.')
  }
  const candidateIds = reviewCase.candidateCustomerIds as string[]
  if (!candidateIds.includes(chosenCustomerId)) {
    throw new ReviewCaseError('That customer was not one of the flagged candidates for this case.')
  }

  const user = await prisma.user.upsert({
    where: { clerkId: reviewCase.clerkUserId },
    update: {},
    create: { clerkId: reviewCase.clerkUserId, email: reviewCase.verifiedEmail },
  })

  const linked = await prisma.$transaction(async (tx) => {
    const fresh = await tx.customer.findUniqueOrThrow({ where: { id: chosenCustomerId } })
    if (fresh.userId) throw new ReviewCaseError('That customer was linked to a different account in the meantime — refresh and try again.')

    await tx.customer.update({ where: { id: chosenCustomerId }, data: { userId: user.id } })
    return tx.customerIdentityReviewCase.update({
      where: { id: reviewCaseId },
      data: { status: 'RESOLVED', resolvedBy: adminUserId, resolvedAt: new Date(), customerId: chosenCustomerId },
    })
  })

  await recordCustomerActivity({
    customerId: chosenCustomerId,
    eventType: 'PORTAL_IDENTITY_CONFLICT_RESOLVED',
    source: 'MANUAL',
    userId: adminUserId,
  })

  return linked
}

export async function dismissIdentityReviewCase(
  reviewCaseId: string,
  adminUserId: string,
  notes?: string
): Promise<CustomerIdentityReviewCase> {
  const reviewCase = await prisma.customerIdentityReviewCase.findUniqueOrThrow({ where: { id: reviewCaseId } })
  if (reviewCase.status !== 'OPEN') {
    throw new ReviewCaseError('This review case has already been resolved.')
  }

  const dismissed = await prisma.customerIdentityReviewCase.update({
    where: { id: reviewCaseId },
    data: { status: 'DISMISSED', resolvedBy: adminUserId, resolvedAt: new Date(), notes: notes ?? undefined },
  })

  if (reviewCase.customerId) {
    await recordCustomerActivity({
      customerId: reviewCase.customerId,
      eventType: 'PORTAL_IDENTITY_CONFLICT_RESOLVED',
      source: 'MANUAL',
      userId: adminUserId,
    })
  }

  return dismissed
}
