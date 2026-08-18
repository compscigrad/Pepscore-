import { describe, it, expect } from 'vitest'
import { retrieveForRole } from './retrieve'
import { Tier1CatalogRetrieval } from './tier1Catalog'
import { FixtureRetrieval } from './tier23Fixtures'
import type { SearchableProduct } from '@/lib/storefront/searchRank'
import type { FixtureSource } from './tier23Fixtures'

const products: SearchableProduct[] = [
  { id: 'p1', name: 'Semaglutide', size: '5mg', category: 'GLP-1 Agonist', searchSynonyms: null },
]

const tier2Fixtures: FixtureSource[] = [
  { sourceId: 's1', title: 'Curated note', sourceType: 'curated_note', tier: 2, content: 'semaglutide research context' },
]

const tier3Fixtures: FixtureSource[] = [
  { sourceId: 's2', title: 'Primary paper', sourceType: 'literature', tier: 3, content: 'semaglutide primary literature abstract' },
]

function buildAdapters() {
  return [
    new Tier1CatalogRetrieval(products),
    new FixtureRetrieval(2, tier2Fixtures),
    new FixtureRetrieval(3, tier3Fixtures),
  ]
}

describe('retrieveForRole', () => {
  it('ANONYMOUS only receives tier 1 results', async () => {
    const results = await retrieveForRole(buildAdapters(), { text: 'semaglutide' }, 'ANONYMOUS')
    expect(results.every((r) => r.tier === 1)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  it('CLIENT receives tier 1 and tier 2, never tier 3', async () => {
    const results = await retrieveForRole(buildAdapters(), { text: 'semaglutide' }, 'CLIENT')
    expect(results.some((r) => r.tier === 1)).toBe(true)
    expect(results.some((r) => r.tier === 2)).toBe(true)
    expect(results.every((r) => r.tier !== 3)).toBe(true)
  })

  it('ADMIN receives all three tiers', async () => {
    const results = await retrieveForRole(buildAdapters(), { text: 'semaglutide' }, 'ADMIN')
    expect(results.some((r) => r.tier === 1)).toBe(true)
    expect(results.some((r) => r.tier === 2)).toBe(true)
    expect(results.some((r) => r.tier === 3)).toBe(true)
  })

  it('a caller-requested tier outside the role boundary is silently dropped, not honored', async () => {
    const results = await retrieveForRole(buildAdapters(), { text: 'semaglutide', allowedTiers: [3] }, 'ANONYMOUS')
    expect(results).toEqual([])
  })
})
