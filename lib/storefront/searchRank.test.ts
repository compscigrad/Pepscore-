import { describe, it, expect } from 'vitest'
import { rankSearch, type SearchableProduct } from './searchRank'

function product(overrides: Partial<SearchableProduct> & { id: string; name: string }): SearchableProduct {
  return { size: '10mg', category: 'Peptide', searchSynonyms: null, ...overrides }
}

// Fixture catalog deliberately includes KLOW and GLOW70 -- two short,
// one-character-apart, but genuinely distinct real products -- plus the
// other names named in the regression spec.
const catalog: SearchableProduct[] = [
  product({ id: 'klow', name: 'KLOW', size: '80mg', category: 'Combination' }),
  product({ id: 'glow70', name: 'GLOW70', size: '70mg', category: 'Combination', searchSynonyms: 'glow 70' }),
  product({ id: 'tesa-10', name: 'Tesamorelin', size: '10mg' }),
  product({ id: 'tesa-5', name: 'Tesamorelin', size: '5mg' }),
  product({ id: 'reta-10', name: 'Retatrutide', size: '10mg' }),
  product({ id: 'reta-60', name: 'Retatrutide', size: '60mg' }),
  product({ id: 'cjc-ipa', name: 'CJC-1295 / Ipamorelin', size: '10mg' }),
  product({ id: 'sema-30', name: 'Semaglutide', size: '30mg' }),
]

function ids(results: ReturnType<typeof rankSearch>): string[] {
  return results.map((r) => r.product.id)
}

describe('rankSearch', () => {
  it('exact "KLOW" returns KLOW only, via the exact-name tier', () => {
    const results = rankSearch('KLOW', catalog)
    expect(ids(results)).toEqual(['klow'])
    expect(results[0].tier).toBe('EXACT_NAME')
  })

  it('exact "GLOW70" returns GLOW70 only, via the exact-name tier', () => {
    const results = rankSearch('GLOW70', catalog)
    expect(ids(results)).toEqual(['glow70'])
    expect(results[0].tier).toBe('EXACT_NAME')
  })

  it('a misspelling of KLOW returns KLOW', () => {
    const results = rankSearch('KLWO', catalog) // transposed letters
    expect(ids(results)).toEqual(['klow'])
  })

  it('a misspelling of GLOW70 returns GLOW70', () => {
    const results = rankSearch('GLOW7O', catalog) // letter O for 0
    expect(ids(results)).toEqual(['glow70'])
  })

  it('KLOW never silently maps to GLOW70', () => {
    const results = rankSearch('KLOW', catalog)
    expect(ids(results)).not.toContain('glow70')
  })

  it('GLOW70 never silently maps to KLOW', () => {
    const results = rankSearch('GLOW70', catalog)
    expect(ids(results)).not.toContain('klow')
  })

  it('a substring shared by two distinct products returns both, not a guess', () => {
    // "LOW" is a substring of both "KLOW" and "GLOW70" -- neither should
    // be silently preferred over the other.
    const results = rankSearch('LOW', catalog)
    expect(ids(results).sort()).toEqual(['glow70', 'klow'])
  })

  it('a genuine fuzzy-tier tie between two distinct products returns both, not a guess', () => {
    const tieCatalog: SearchableProduct[] = [
      product({ id: 'aaax', name: 'AAAX', size: '10mg' }),
      product({ id: 'aaay', name: 'AAAY', size: '10mg' }),
      product({ id: 'unrelated', name: 'Semaglutide', size: '30mg' }),
    ]
    // "AAAZ" is a single substitution away from both AAAX and AAAY, and
    // isn't a substring of either -- a genuine fuzzy-tier tie.
    const results = rankSearch('AAAZ', tieCatalog)
    expect(results.every((r) => r.tier === 'FUZZY')).toBe(true)
    expect(ids(results).sort()).toEqual(['aaax', 'aaay'])
  })

  it('"Tesamorlin" (missing e) fuzzy-matches Tesamorelin, both strengths', () => {
    const results = rankSearch('Tesamorlin', catalog)
    expect(ids(results).sort()).toEqual(['tesa-10', 'tesa-5'])
    expect(results.every((r) => r.tier === 'FUZZY')).toBe(true)
  })

  it('"Retatrutid" (missing e) matches Retatrutide, both strengths', () => {
    const results = rankSearch('Retatrutid', catalog)
    expect(ids(results).sort()).toEqual(['reta-10', 'reta-60'])
  })

  it('"CJC Ipa" token-matches CJC-1295 / Ipamorelin', () => {
    const results = rankSearch('CJC Ipa', catalog)
    expect(ids(results)).toEqual(['cjc-ipa'])
    expect(results[0].tier).toBe('PREFIX_TOKEN')
  })

  it('strength-specific search narrows to the single matching strength', () => {
    const results = rankSearch('Tesamorelin 10mg', catalog)
    expect(ids(results)).toEqual(['tesa-10'])
  })

  it('exact name + strength query resolves via the dedicated tier', () => {
    const results = rankSearch('Semaglutide 30mg', catalog)
    expect(ids(results)).toEqual(['sema-30'])
    expect(results[0].tier).toBe('EXACT_NAME_STRENGTH')
  })

  it('an approved alias/synonym resolves via the exact-alias tier, ranked above fuzzy', () => {
    const results = rankSearch('glow 70', catalog)
    expect(ids(results)).toEqual(['glow70'])
    expect(results[0].tier).toBe('EXACT_ALIAS')
  })

  it('formatting variations (hyphen/space/case) resolve via the normalized tier', () => {
    const results = rankSearch('glow-70', catalog)
    expect(ids(results)).toEqual(['glow70'])
    expect(results[0].tier).toBe('NORMALIZED')
  })

  it('a completely unrelated query produces a true zero-result state', () => {
    const results = rankSearch('xyzzy nonsense query', catalog)
    expect(results).toEqual([])
  })

  it('an empty query produces a zero-result state', () => {
    expect(rankSearch('', catalog)).toEqual([])
    expect(rankSearch('   ', catalog)).toEqual([])
  })

  it('a stronger tier always wins over a weaker one when both would match', () => {
    // "KLOW" would also satisfy the token/prefix tier trivially, but the
    // exact-name tier must win and short-circuit before token matching
    // (or fuzzy matching) ever runs.
    const results = rankSearch('KLOW', catalog)
    expect(results).toHaveLength(1)
    expect(results[0].tier).toBe('EXACT_NAME')
  })
})
