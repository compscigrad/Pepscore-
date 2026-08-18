import { describe, it, expect } from 'vitest'
import { FixtureRetrieval, TIER_2_3_FIXTURES } from './tier23Fixtures'
import type { FixtureSource } from './tier23Fixtures'

describe('TIER_2_3_FIXTURES', () => {
  it('is empty by default -- no content has been curated/approved yet', () => {
    expect(TIER_2_3_FIXTURES).toEqual([])
  })
})

const testFixtures: FixtureSource[] = [
  { sourceId: 's1', title: 'Fixture A', sourceType: 'curated_note', tier: 2, content: 'discusses mitochondrial biogenesis' },
  { sourceId: 's2', title: 'Fixture B', sourceType: 'literature', tier: 3, content: 'a primary literature abstract on peptide stability' },
]

describe('FixtureRetrieval', () => {
  it('only returns fixtures matching its own configured tier', async () => {
    const tier2 = new FixtureRetrieval(2, testFixtures)
    const results = await tier2.retrieve({ text: 'mitochondrial' })
    expect(results).toHaveLength(1)
    expect(results[0].sourceId).toBe('s1')
  })

  it('matches by substring against fixture content', async () => {
    const tier3 = new FixtureRetrieval(3, testFixtures)
    const results = await tier3.retrieve({ text: 'peptide stability' })
    expect(results[0].sourceId).toBe('s2')
  })

  it('returns nothing when its own tier is excluded from allowedTiers', async () => {
    const tier2 = new FixtureRetrieval(2, testFixtures)
    const results = await tier2.retrieve({ text: 'mitochondrial', allowedTiers: [1, 3] })
    expect(results).toEqual([])
  })

  it('returns nothing for a query with no substring match', async () => {
    const tier2 = new FixtureRetrieval(2, testFixtures)
    const results = await tier2.retrieve({ text: 'zzz-no-match' })
    expect(results).toEqual([])
  })
})
