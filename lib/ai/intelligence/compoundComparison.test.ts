import { describe, it, expect } from 'vitest'
import { compareCompounds, buildComparisonEntries, buildPolicyCheckText } from './compoundComparison'

describe('buildPolicyCheckText', () => {
  it('produces a plain research-comparison sentence with no personal note', () => {
    expect(buildPolicyCheckText(['MOTS-c', 'NAD+'])).toBe('Compare the research classifications of MOTS-c and NAD+.')
  })

  it('appends a personal-intent note when provided', () => {
    const text = buildPolicyCheckText(['MOTS-c', 'NAD+'], 'and tell me which is better for me to take')
    expect(text).toContain('which is better for me to take')
  })
})

describe('buildComparisonEntries', () => {
  const products = [
    { id: 'p1', name: 'GHK-Cu', category: 'Copper Peptide', description: 'Studied for tissue remodeling.' },
  ]

  it('marks a found product with its category and citation', () => {
    const entries = buildComparisonEntries(['GHK-Cu'], products)
    expect(entries[0].found).toBe(true)
    expect(entries[0].rawCategory).toBe('Copper Peptide')
    expect(entries[0].citation?.sourceId).toBe('p1')
    // GHK-Cu belongs to the recovery-injury-research and skin-hair-cosmetic
    // taxonomy groups -- confirms real taxonomy lookup, not a stub.
    expect(entries[0].researchCategories.length).toBeGreaterThan(0)
  })

  it('marks an unrecognized product name as not found, with no fabricated data', () => {
    const entries = buildComparisonEntries(['Not A Real Product'], products)
    expect(entries[0]).toEqual({
      productName: 'Not A Real Product',
      found: false,
      rawCategory: null,
      researchCategories: [],
      description: null,
      citation: null,
    })
  })

  it('preserves the requested order and count even with a mix of found/not-found', () => {
    const entries = buildComparisonEntries(['GHK-Cu', 'Nonexistent'], products)
    expect(entries.map((e) => e.productName)).toEqual(['GHK-Cu', 'Nonexistent'])
    expect(entries[0].found).toBe(true)
    expect(entries[1].found).toBe(false)
  })
})

describe('compareCompounds', () => {
  it('requires at least two product names', async () => {
    const result = await compareCompounds(['GHK-Cu'], 'CLIENT')
    expect(result.status).toBe('REFUSED')
    expect(result.entries).toEqual([])
  })

  it('refuses a comparison request carrying a personal-use intent, never reaching the database', async () => {
    const result = await compareCompounds(['GHK-Cu', 'NAD+'], 'CLIENT', {
      personalIntentNote: 'what should I take for weight loss',
    })
    expect(result.status).toBe('REFUSED')
    expect(result.entries).toEqual([])
  })
})
