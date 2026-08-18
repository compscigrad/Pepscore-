import { describe, it, expect } from 'vitest'
import { Tier1CatalogRetrieval } from './tier1Catalog'
import type { SearchableProduct } from '@/lib/storefront/searchRank'

const products: SearchableProduct[] = [
  { id: 'p1', name: 'Semaglutide', size: '5mg', category: 'GLP-1 Agonist', searchSynonyms: null },
  { id: 'p2', name: 'Tirzepatide', size: '10mg', category: 'Dual GIP/GLP-1', searchSynonyms: null },
  { id: 'p3', name: 'GLOW70', size: '70mg', category: 'Combination', searchSynonyms: null },
]

describe('Tier1CatalogRetrieval', () => {
  it('wraps the real rankSearch matcher -- an exact name match ranks first', async () => {
    const retrieval = new Tier1CatalogRetrieval(products)
    const results = await retrieval.retrieve({ text: 'Semaglutide' })
    expect(results[0].sourceId).toBe('p1')
    expect(results[0].title).toContain('Semaglutide')
  })

  it('tags every result as tier 1 with a citation label', async () => {
    const retrieval = new Tier1CatalogRetrieval(products)
    const results = await retrieval.retrieve({ text: 'Tirzepatide' })
    expect(results[0].tier).toBe(1)
    expect(results[0].citationLabel).toContain('Pepscore Catalog')
  })

  it('respects maxResults', async () => {
    const retrieval = new Tier1CatalogRetrieval(products)
    const results = await retrieval.retrieve({ text: 'e', maxResults: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('returns nothing when tier 1 is excluded from allowedTiers', async () => {
    const retrieval = new Tier1CatalogRetrieval(products)
    const results = await retrieval.retrieve({ text: 'Semaglutide', allowedTiers: [2, 3] })
    expect(results).toEqual([])
  })

  it('returns an empty array for a query matching nothing', async () => {
    const retrieval = new Tier1CatalogRetrieval(products)
    const results = await retrieval.retrieve({ text: 'zzz-nonexistent-compound' })
    expect(results).toEqual([])
  })
})
