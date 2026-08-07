// Resolves whether the *current* storefront visitor should see SPA case
// pricing -- read-only, never creates a User/Customer row (mirrors
// lib/portalAuth.ts's resolveClerkUserId: an unauthenticated visitor, or a
// signed-in one with no linked Customer yet, simply resolves to false).
// Called from server components on every public pricing surface
// (homepage, category pages, product detail pages, search) so eligibility
// is always re-derived from the real session, never trusted from a client.
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function getCurrentCustomerSpaEligible(): Promise<boolean> {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return false

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { customer: { select: { spaEligible: true, portalAccessDisabled: true } } } })
  if (!user?.customer) return false
  // A customer whose portal access has been disabled (e.g. compromised
  // session, active dispute) shouldn't see SPA pricing either, even if
  // spaEligible was never separately revoked.
  if (user.customer.portalAccessDisabled) return false

  return user.customer.spaEligible
}
