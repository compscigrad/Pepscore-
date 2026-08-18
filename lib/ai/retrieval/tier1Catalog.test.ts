import { describe, it, expect } from 'vitest'
import { Tier1CatalogRetrieval } from './tier1Catalog'
import type { SearchableProduct } from '@/lib/storefront/searchRank'

const products: SearchableProduct[] = [
  { id: 'p1', name: 'Semaglutide', size: '5mg', category: 'GLP-1 Agonist', searchSynonyms: null },
  { id: 'p2', name: 'Tirzepatide', size: '10mg', category: 'Dual GIP/GLP-1', searchSynonyms: null },
  { id: 'p3', name: 'GLOW70', size: '70mg', category: 'Combination', searchSynonyms: null },
  { id: 'p4', name: 'MOTS-c', size: '10mg', category: 'Mitochondrial Peptide', searchSynonyms: null },
  { id: 'p5', name: 'SS-31', size: '10mg', category: 'Mitochondrial Peptide', searchSynonyms: null },
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

  // 2026-08-18 live-verification finding: rankSearch's every-token-must-
  // match rule (correct for the storefront search box) legitimately misses
  // full natural-language research questions, even when Pepscore has real,
  // authoritative catalog data that answers them -- this adapter needs its
  // own topic-level fallback so the live pipeline doesn't silently ground
  // nothing and let the model answer from general training knowledge alone.
  describe('natural-language topic fallback (when rankSearch finds nothing)', () => {
    it('retrieves products by category when the query names a research topic, not a product', async () => {
      const retrieval = new Tier1CatalogRetrieval(products)
      const results = await retrieval.retrieve({
        text: 'What Pepscore catalog families are associated with mitochondrial research?',
      })
      const ids = results.map((r) => r.sourceId)
      expect(ids).toEqual(expect.arrayContaining(['p4', 'p5']))
      expect(ids).not.toContain('p1')
    })

    it('retrieves a product mentioned by name inside a full sentence, not just a bare name query', async () => {
      const retrieval = new Tier1CatalogRetrieval(products)
      const results = await retrieval.retrieve({
        text: 'Compare the research classifications of MOTS-c and Semaglutide.',
      })
      const ids = results.map((r) => r.sourceId)
      expect(ids).toEqual(expect.arrayContaining(['p4', 'p1']))
    })

    it('still returns nothing for a question with no real product or category connection', async () => {
      const retrieval = new Tier1CatalogRetrieval(products)
      const results = await retrieval.retrieve({
        text: 'What should I take for weight loss?',
      })
      expect(results).toEqual([])
    })

    it('does not fall through to the topic pass when rankSearch already found an exact match', async () => {
      const retrieval = new Tier1CatalogRetrieval(products)
      const results = await retrieval.retrieve({ text: 'Semaglutide' })
      expect(results).toHaveLength(1)
      expect(results[0].sourceId).toBe('p1')
    })
  })
})
