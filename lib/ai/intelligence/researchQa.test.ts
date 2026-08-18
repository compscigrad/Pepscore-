import { describe, it, expect } from 'vitest'
import { askResearchQuestion } from './researchQa'

describe('askResearchQuestion', () => {
  it('requires a non-empty question, never reaching config/provider/database', async () => {
    const result = await askResearchQuestion('  ', 'CLIENT', 'test-id')
    expect(result.status).toBe('REFUSED')
    expect(result.reason).toBe('A question is required.')
  })

  it('returns UNAVAILABLE with no database call when no live provider can be built -- matches production reality today (AI_FEATURE_ENABLED unset in this test run)', async () => {
    const result = await askResearchQuestion('What research areas involve mitochondrial peptides?', 'CLIENT', 'test-id')
    expect(result.status).toBe('UNAVAILABLE')
    expect(result.reason).toBe('Free-text research Q&A is not currently available.')
  })
})
