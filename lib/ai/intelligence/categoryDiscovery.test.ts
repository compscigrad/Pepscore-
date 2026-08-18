import { describe, it, expect } from 'vitest'
import { discoverByCategory, buildDiscoveryEntries } from './categoryDiscovery'

describe('buildDiscoveryEntries', () => {
  it('builds a citation-carrying entry per product', () => {
    const entries = buildDiscoveryEntries([{ id: 'p1', name: 'NAD+', description: 'Longevity research context.' }])
    expect(entries).toHaveLength(1)
    expect(entries[0].productName).toBe('NAD+')
    expect(entries[0].citation.sourceId).toBe('p1')
    expect(entries[0].citation.tier).toBe(1)
  })

  it('returns an empty array for no products -- never fabricates entries', () => {
    expect(buildDiscoveryEntries([])).toEqual([])
  })
})

describe('discoverByCategory', () => {
  // Only the paths that short-circuit before the database are covered
  // here (matches this repo's established convention of not unit-testing
  // Prisma-backed code in the fast suite -- see lib/invoice/
  // numbering.test.ts). The real end-to-end DB fetch is exercised the
  // same way lib/invoices.ts's own DB paths are, not re-tested here.
  it('returns NOT_FOUND for an unrecognized category slug, never touching the database', async () => {
    const result = await discoverByCategory('not-a-real-category-slug', 'CLIENT')
    expect(result.status).toBe('NOT_FOUND')
    expect(result.entries).toEqual([])
  })
})
