// Storefront product search -- matches name, strength (size), and category.
// Splits the query into tokens and requires every token to match at least
// one field (AND across tokens, OR within a token's field candidates), so
// "Tesamorelin 10mg" resolves to the single correct 10mg product rather
// than an ambiguous list of every Tesamorelin strength -- "Tesamorelin"
// matches every row's name, but only the 10mg row's `size` also matches
// "10mg", so the AND narrows correctly.
//
// This is substring matching (Prisma/Postgres ILIKE), not true fuzzy/typo
// tolerance -- real typo tolerance would need trigram similarity
// (pg_trgm) or a dedicated search service, a real infrastructure decision
// this PR doesn't make unilaterally. Substring matching already covers
// the common case (partial words, case-insensitivity, word order) well.
import { prisma } from '@/lib/prisma'
import type { Product } from '@prisma/client'

export async function searchProducts(query: string): Promise<Product[]> {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  return prisma.product.findMany({
    where: {
      pricingStatus: { not: 'INACTIVE' },
      AND: tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: 'insensitive' as const } },
          { size: { contains: token, mode: 'insensitive' as const } },
          { category: { contains: token, mode: 'insensitive' as const } },
        ],
      })),
    },
    orderBy: { createdAt: 'asc' },
  })
}
