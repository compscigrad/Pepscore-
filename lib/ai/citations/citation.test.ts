import { describe, it, expect } from 'vitest'
import { toCitation, deduplicateCitations } from './citation'
import type { RetrievedSource } from '../retrieval/types'

function source(overrides: Partial<RetrievedSource> = {}): RetrievedSource {
  return {
    sourceId: 's1',
    title: 'Title',
    sourceType: 'catalog_product',
    tier: 1,
    retrievalScore: 1,
    citationLabel: 'Pepscore Catalog: Title',
    content: 'content',
    ...overrides,
  }
}

describe('toCitation', () => {
  it('projects the citation-relevant fields from a retrieved source', () => {
    const citation = toCitation(source({ url: 'https://example.com' }))
    expect(citation).toEqual({
      sourceId: 's1',
      citationLabel: 'Pepscore Catalog: Title',
      tier: 1,
      sourceType: 'catalog_product',
      url: 'https://example.com',
    })
  })
})

describe('deduplicateCitations', () => {
  it('removes duplicate sourceIds, keeping the first occurrence', () => {
    const citations = [toCitation(source({ sourceId: 'a' })), toCitation(source({ sourceId: 'a' })), toCitation(source({ sourceId: 'b' }))]
    const deduped = deduplicateCitations(citations)
    expect(deduped).toHaveLength(2)
    expect(deduped.map((c) => c.sourceId)).toEqual(['a', 'b'])
  })

  it('returns an empty array unchanged', () => {
    expect(deduplicateCitations([])).toEqual([])
  })
})
