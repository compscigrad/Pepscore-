// The single choke point for "is the current request a genuinely
// authorized customer, and which Customer record do they own" — every
// portal page and API route calls getPortalCustomer() first, before any
// other query, and scopes every subsequent query by the returned id. Never
// trust a client-supplied customerId/invoiceId; ownership is always
// re-derived server-side from the authenticated Clerk session.
//
// Structurally mirrors the admin surface's isAdmin(userId) pattern (audited
// this session, proven correct) — same shape, different trust boundary:
// admin checks one hardcoded env var id, this checks a real DB relation.
import { auth } from '@clerk/nextjs/server'
import type { Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Customer.userId is a foreign key to User.id, not the raw Clerk id (Clerk's
// id lives on User.clerkId) — every lookup here goes through User first.
// Read-only: unlike claimPortalInvite(), this never creates a User row, so
// a signed-in Clerk user who has never claimed anything simply resolves to
// no User and therefore no Customer, exactly as it should.
async function resolveClerkUserId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })
  return user?.id ?? null
}

// Null covers every "not authorized" case alike (not signed in, no linked
// Customer, access disabled) — callers redirect/403 uniformly rather than
// branching on why, so no code path can accidentally treat a disabled
// account as "just not linked yet" and offer to re-claim it silently.
export async function getPortalCustomer(): Promise<Customer | null> {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return null

  const userId = await resolveClerkUserId(clerkUserId)
  if (!userId) return null

  return prisma.customer.findFirst({
    where: { userId, portalAccessDisabled: false },
  })
}

// For routes that need to know *why* access failed (e.g. the claim page,
// which must tell a disabled-but-still-linked user something different
// than a never-linked one) — kept separate from getPortalCustomer() so
// every ordinary ownership check stays a single null check.
export type PortalAuthState =
  | { state: 'UNAUTHENTICATED' }
  | { state: 'NOT_LINKED' }
  | { state: 'DISABLED' }
  | { state: 'AUTHORIZED'; customer: Customer }

export async function getPortalAuthState(): Promise<PortalAuthState> {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return { state: 'UNAUTHENTICATED' }

  const userId = await resolveClerkUserId(clerkUserId)
  if (!userId) return { state: 'NOT_LINKED' }

  const customer = await prisma.customer.findFirst({ where: { userId } })
  if (!customer) return { state: 'NOT_LINKED' }
  if (customer.portalAccessDisabled) return { state: 'DISABLED' }
  return { state: 'AUTHORIZED', customer }
}
