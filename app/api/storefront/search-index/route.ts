// Lightweight, public-safe product index for the navbar's predictive
// search dropdown (components/storefront/PredictiveSearch.tsx). Fetched
// once client-side and cached for the session -- matching against ~100
// products locally (lib/storefront/searchRank.ts's existing rankSearch())
// is effectively instant, so there's no per-keystroke request to debounce.
//
// Deliberately a separate, minimal projection rather than reusing
// searchProducts() (lib/storefront/search.ts) directly -- that function
// returns full Product rows (cost, supplier pricing, internal notes) meant
// for the server-rendered /search results page, which never sends the raw
// rows to the browser. This route ships to the client, so only the fields
// SearchableProduct's ranking needs plus display fields are selected.
// Same inclusion rule as searchProducts() -- only INACTIVE is excluded,
// availability/stock never affects discoverability.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveProductImage } from '@/lib/storefront/productImages'

export const revalidate = 60

export async function GET() {
  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, size: true, slug: true, category: true, searchSynonyms: true, imageUrl: true },
  })

  const index = products.map((p) => ({
    id: p.id,
    name: p.name,
    size: p.size,
    slug: p.slug,
    category: p.category,
    searchSynonyms: p.searchSynonyms,
    imageUrl: resolveProductImage(p.name, p.imageUrl),
  }))

  return NextResponse.json({ products: index })
}
