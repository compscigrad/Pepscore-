// Storefront product search — fetches the active catalog (small at today's
// scale, ~100 rows) and ranks it in-process via lib/storefront/searchRank.ts's
// pure, unit-tested tiered matching (exact name -> exact name+strength ->
// exact alias -> normalized formatting -> prefix/token -> typo/fuzzy).
//
// Only pricingStatus excludes a product from search results -- never
// availability/stock. An active product that's out of stock, low stock,
// backordered, or awaiting restock must stay discoverable; availability
// only changes the fulfillment messaging shown on its own page, never
// whether it can be found at all. Only INACTIVE (discontinued, or
// temporarily unpublished pending pricing input) products are excluded.
import { prisma } from '@/lib/prisma'
import type { Product } from '@prisma/client'
import { rankSearch } from './searchRank'

export async function searchProducts(query: string): Promise<Product[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const candidates = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    orderBy: { createdAt: 'asc' },
  })

  return rankSearch(trimmed, candidates).map((r) => r.product)
}
