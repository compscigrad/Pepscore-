// Resolves active Customer Preferred Pricing (Price Match Guarantee sprint,
// 2026-08-20) -- the server-side lookup every real pricing surface must call
// before building PricingLineRequest[] for lib/pricing/canonicalPricing.ts.
// Mirrors lib/storefront/professionalAccess.ts's resolveProEligibleByClerkUserId
// exactly: the caller resolves this from a real Customer/Clerk identity and
// passes the result into the engine as PricingLineRequest.preferredPrice,
// never anything client-submitted.
//
// Defense in depth on expiry: UNTIL_DATE authorizations are also flipped to
// EXPIRED by a sweep (see lib/pricing/expirePreferredPricing.ts), but this
// query independently excludes any row past its expiresAt regardless of
// whether that sweep has run yet -- an authorization is never honored past
// its own expiry just because a cron hasn't caught up.
import { prisma } from '@/lib/prisma'

export interface PreferredPriceLookup {
  productId: string
  // Accepts either the Prisma InvoiceItemSellUnit enum or the identically-
  // valued lib/pricing/sellUnits.ts SellUnit union -- only ever used to
  // build/match a string key, never passed into a typed Prisma field.
  sellUnit: string
}

function lineKey(productId: string, sellUnit: string): string {
  return `${productId}:${sellUnit}`
}

// Isolation is enforced entirely by the WHERE clause: customerId AND
// productId AND sellUnit must all match exactly (section 20's explicit
// multi-product-cart requirement -- an authorization for Tesamorelin 10mg
// CASE_STANDARD must never discount Tesamorelin 5mg, a different sellUnit
// of the same product, or any other customer's cart).
export async function resolveActivePreferredPricesByCustomerId(
  customerId: string | null,
  lines: PreferredPriceLookup[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!customerId || lines.length === 0) return result

  const rows = await prisma.priceMatchAuthorization.findMany({
    where: {
      customerId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      productId: { in: [...new Set(lines.map((l) => l.productId))] },
    },
    select: { productId: true, sellUnit: true, authorizedPrice: true },
  })

  const wanted = new Set(lines.map((l) => lineKey(l.productId, l.sellUnit)))
  for (const row of rows) {
    const key = lineKey(row.productId, row.sellUnit)
    if (wanted.has(key)) result.set(key, row.authorizedPrice)
  }
  return result
}

// Authenticated-only, by Clerk userId -- never resolved by email match, same
// rationale as Professional Access (guest checkout must never unlock a real
// customer's negotiated price just by typing their email address).
export async function resolveActivePreferredPricesByClerkUserId(
  clerkUserId: string | null,
  lines: PreferredPriceLookup[]
): Promise<Map<string, number>> {
  if (!clerkUserId) return new Map()
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { customer: { select: { id: true, portalAccessDisabled: true } } } })
  if (!user?.customer || user.customer.portalAccessDisabled) return new Map()
  return resolveActivePreferredPricesByCustomerId(user.customer.id, lines)
}

export function preferredPriceFor(map: Map<string, number>, productId: string, sellUnit: string): number | null {
  return map.get(lineKey(productId, sellUnit)) ?? null
}
