// AI-0B.4 -- Tier 1 retrieval, wrapping the EXISTING catalog search
// (lib/storefront/searchRank.ts) rather than duplicating its matching
// logic. Owner instruction, item 14: "Do not duplicate searchRank.ts/
// search-index/Product querying merely to label it AI retrieval. Build an
// internal retrieval adapter around the existing source." This file is
// exactly that adapter -- rankSearch() itself is untouched, unit-tested
// separately (lib/storefront/searchRank.test.ts), and reused as-is.
import { rankSearch, type SearchableProduct } from '@/lib/storefront/searchRank'
import type { RetrievalAdapter, RetrievalQuery, RetrievedSource } from './types'

const DEFAULT_MAX_RESULTS = 8

export class Tier1CatalogRetrieval implements RetrievalAdapter {
  readonly tier = 1 as const

  constructor(private readonly products: SearchableProduct[]) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievedSource[]> {
    if (query.allowedTiers && !query.allowedTiers.includes(1)) return []

    const ranked = rankSearch(query.text, this.products)
    const max = query.maxResults ?? DEFAULT_MAX_RESULTS
    const limited = ranked.slice(0, max)

    return limited.map((match, i) => ({
      sourceId: match.product.id,
      title: `${match.product.name} ${match.product.size}`,
      sourceType: 'catalog_product',
      tier: 1 as const,
      // Simple rank-based score (1.0 for the top result, decreasing) --
      // rankSearch's own tiered ordering (exact/alias/normalized/token/
      // fuzzy) is the real ranking signal; this just exposes it as a
      // 0-1 number for citation display, it isn't a second scoring model.
      retrievalScore: limited.length > 1 ? 1 - i / limited.length : 1,
      citationLabel: `Pepscore Catalog: ${match.product.name} ${match.product.size}`,
      content: `${match.product.name} ${match.product.size} -- category: ${match.product.category}`,
    }))
  }
}
