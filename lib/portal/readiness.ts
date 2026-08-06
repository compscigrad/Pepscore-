// Portal-readiness status for a Customer — always derived, never stored,
// mirroring CustomerStatus (lib/customers.ts's computeCustomerStatus) and
// PortalInviteState's existing precedent of computing state from timestamps/
// relations rather than keeping a redundant field in sync. Used by the
// admin customer list/detail (badges) and the eligible-invite-audience
// calculation (lib/portal/rolloutAudience.ts) so both always agree.
import type { Customer, CustomerPortalInvite } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPortalInviteState } from '@/lib/portalInviteState'

export type PortalReadinessStatus =
  | 'CLAIMED'
  | 'DISABLED'
  | 'CONFLICT_REVIEW'
  | 'INVITE_SENT'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'UNCLAIMED_ELIGIBLE'
  | 'MISSING_CONTACT'

export async function getPortalReadinessStatus(customer: Customer): Promise<PortalReadinessStatus> {
  if (customer.userId) {
    return customer.portalAccessDisabled ? 'DISABLED' : 'CLAIMED'
  }

  const openReviewCase = await prisma.customerIdentityReviewCase.findFirst({
    where: { customerId: customer.id, status: 'OPEN' },
  })
  if (openReviewCase) return 'CONFLICT_REVIEW'

  const invites = await prisma.customerPortalInvite.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
  })
  const mostRecent = mostRecentRelevantInvite(invites)
  if (mostRecent) {
    const state = getPortalInviteState(mostRecent)
    if (state === 'ACTIVE') return 'INVITE_SENT'
    if (state === 'EXPIRED') return 'INVITE_EXPIRED'
    if (state === 'REVOKED') return 'INVITE_REVOKED'
    // CLAIMED shouldn't reach here (customer.userId would be set), but fall
    // through defensively rather than assert.
  }

  if (!customer.email && !customer.phone) return 'MISSING_CONTACT'
  return 'UNCLAIMED_ELIGIBLE'
}

// A customer can have several invites over time (revoked-and-resent); the
// status should reflect the most recent one, not an arbitrary one.
function mostRecentRelevantInvite(invites: CustomerPortalInvite[]): CustomerPortalInvite | null {
  return invites[0] ?? null
}
