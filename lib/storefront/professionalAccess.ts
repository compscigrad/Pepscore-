// Resolves whether a storefront visitor is entitled to Professional Access
// pricing -- the single, server-side-authoritative source every real
// pricing surface must use (renamed from spaEligibility.ts, 2026-08-19
// Professional Access sprint -- see lib/pricing/canonicalPricing.ts's
// header for the P0 defect this closes).
//
// Deliberately authenticated-only, by Clerk userId -- NEVER resolved by
// email match. resolveCustomerIdForCheckout() (lib/promotions/redemption.ts)
// intentionally falls back to a case-insensitive email match for guest
// checkout so a promo code or an existing invoice can still be found; that's
// an acceptable convenience for a coupon-grade discount. Professional
// pricing is a protected account entitlement, not a coupon -- if email
// matching were allowed here, any guest could unlock a real customer's
// Professional price just by typing their email address at checkout, with
// no proof of identity at all. Guests are always proEligible: false.
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function resolveProEligibleByClerkUserId(clerkUserId: string | null): Promise<boolean> {
  if (!clerkUserId) return false

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { customer: { select: { proEligible: true, portalAccessDisabled: true } } } })
  if (!user?.customer) return false
  // A customer whose portal access has been disabled (e.g. compromised
  // session, active dispute) shouldn't get Professional pricing either,
  // even if proEligible was never separately revoked.
  if (user.customer.portalAccessDisabled) return false

  return user.customer.proEligible
}

// Convenience wrapper for server components that haven't already called
// auth() themselves (homepage, category pages, product detail, search) --
// read-only, never creates a User/Customer row.
export async function getCurrentCustomerProEligible(): Promise<boolean> {
  const { userId: clerkUserId } = await auth()
  return resolveProEligibleByClerkUserId(clerkUserId)
}
