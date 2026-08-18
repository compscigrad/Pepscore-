// AI-0B.4 -- Tier 1 retrieval, wrapping the EXISTING catalog search
// (lib/storefront/searchRank.ts) rather than duplicating its matching
// logic. Owner instruction, item 14: "Do not duplicate searchRank.ts/
// search-index/Product querying merely to label it AI retrieval. Build an
// internal retrieval adapter around the existing source." This file is
// exactly that adapter -- rankSearch() itself is untouched, unit-tested
// separately (lib/storefront/searchRank.test.ts), and reused as-is.
//
// rankSearch() is a product-NAME lookup (its every-token-must-match rule
// is correct for the storefront search box, where a user types a partial
// product name). A natural-language research question -- "What catalog
// families are associated with mitochondrial research?" -- tokenizes into
// mostly stopwords that never match a product field, so rankSearch
// legitimately returns nothing for it even when Pepscore has authoritative
// data (2026-08-18 live-verification finding: real "Mitochondrial Peptide"
// category, zero retrieval). Fixing this by loosening rankSearch itself
// would risk regressing real customer search, so instead this adapter adds
// a second, adapter-local matching pass -- product-name-mentioned-in-query
// and category-word-mentioned-in-query -- that only runs when rankSearch's
// stricter tiers found nothing at all.
import { rankSearch, type SearchableProduct } from '@/lib/storefront/searchRank'
import type { RetrievalAdapter, RetrievalQuery, RetrievedSource } from './types'

const DEFAULT_MAX_RESULTS = 8

// Below this length a category word (e.g. a bare unit like "mg") is too
// generic to treat as a topic signal on its own.
const MIN_CATEGORY_WORD_LENGTH = 4

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function queryMentionsProductName(queryLower: string, product: SearchableProduct): boolean {
  return queryLower.includes(product.name.toLowerCase())
}

function queryMentionsCategory(queryLower: string, product: SearchableProduct): boolean {
  return product.category
    .split(/\s+/)
    .map(normalizeWord)
    .filter((word) => word.length >= MIN_CATEGORY_WORD_LENGTH)
    .some((word) => queryLower.includes(word))
}

export class Tier1CatalogRetrieval implements RetrievalAdapter {
  readonly tier = 1 as const

  constructor(private readonly products: SearchableProduct[]) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievedSource[]> {
    if (query.allowedTiers && !query.allowedTiers.includes(1)) return []

    const ranked = rankSearch(query.text, this.products)
    const matched =
      ranked.length > 0
        ? ranked.map((m) => m.product)
        : this.matchByTopic(query.text)

    const max = query.maxResults ?? DEFAULT_MAX_RESULTS
    const limited = matched.slice(0, max)

    return limited.map((product, i) => ({
      sourceId: product.id,
      title: `${product.name} ${product.size}`,
      sourceType: 'catalog_product',
      tier: 1 as const,
      // Simple rank-based score (1.0 for the top result, decreasing) --
      // rankSearch's own tiered ordering (exact/alias/normalized/token/
      // fuzzy) is the real ranking signal when it produced the matches;
      // this just exposes position as a 0-1 number for citation display,
      // it isn't a second scoring model.
      retrievalScore: limited.length > 1 ? 1 - i / limited.length : 1,
      citationLabel: `Pepscore Catalog: ${product.name} ${product.size}`,
      content: `${product.name} ${product.size} -- category: ${product.category}`,
    }))
  }

  // Topic-level fallback: does the query mention a real product by name,
  // or a real category by name? Reused, canonical Product data only -- no
  // shadow catalog, no hardcoded query text.
  private matchByTopic(text: string): SearchableProduct[] {
    const queryLower = text.toLowerCase()
    return this.products.filter(
      (p) => queryMentionsProductName(queryLower, p) || queryMentionsCategory(queryLower, p)
    )
  }
}
