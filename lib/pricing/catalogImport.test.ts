import { describe, it, expect } from 'vitest'
import { matchCatalogRows, normalizeProductName, normalizeStrength } from './catalogImport'
import type { PriceTableRow, CatalogProductCandidate } from './catalogImport'

function row(overrides: Partial<PriceTableRow>): PriceTableRow {
  return { product: 'Semaglutide', strength: '5 mg', supplierCost: 46, caseStandardPrice: 370, spaPrice: 261, individualVialPrice: 49, ...overrides }
}
function product(overrides: Partial<CatalogProductCandidate>): CatalogProductCandidate {
  return { id: 'p1', name: 'Semaglutide', size: '5mg', ...overrides }
}

describe('normalizeProductName / normalizeStrength', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeProductName('  Semaglutide  ')).toBe('semaglutide')
    expect(normalizeStrength('5 mg')).toBe('5mg')
    expect(normalizeStrength('5mg')).toBe('5mg')
  })
})

describe('matchCatalogRows', () => {
  it('matches a sheet row to its DB product despite the "5 mg" vs "5mg" spacing difference', () => {
    const result = matchCatalogRows([row({})], [product({})])
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].product.id).toBe('p1')
    expect(result.unmatchedSheetRows).toHaveLength(0)
    expect(result.unmatchedProducts).toHaveLength(0)
  })

  it('reports a sheet row with no DB product as unmatched (GLOW70\'s real case)', () => {
    const result = matchCatalogRows([row({ product: 'GLOW70', strength: '70 mg' })], [])
    expect(result.unmatchedSheetRows).toHaveLength(1)
    expect(result.matched).toHaveLength(0)
  })

  it('reports a DB product with no sheet row as unmatched', () => {
    const result = matchCatalogRows([], [product({ id: 'p2', name: 'BAC Water', size: '3ml' })])
    expect(result.unmatchedProducts).toHaveLength(1)
    expect(result.unmatchedProducts[0].id).toBe('p2')
  })

  it('routes to ambiguous when more than one DB product shares the same normalized product+strength key, never guessing', () => {
    const dupProducts = [product({ id: 'a' }), product({ id: 'b' })]
    const result = matchCatalogRows([row({})], dupProducts)
    expect(result.ambiguous).toHaveLength(1)
    expect(result.ambiguous[0].candidates.map((c) => c.id).sort()).toEqual(['a', 'b'])
    expect(result.matched).toHaveLength(0)
  })

  it('matches distinct strengths of the same product name to distinct products', () => {
    const rows = [row({ strength: '5 mg' }), row({ strength: '10 mg', supplierCost: 55 })]
    const products = [product({ id: 'p5', size: '5mg' }), product({ id: 'p10', size: '10mg' })]
    const result = matchCatalogRows(rows, products)
    expect(result.matched).toHaveLength(2)
    expect(result.matched.find((m) => m.row.strength === '5 mg')?.product.id).toBe('p5')
    expect(result.matched.find((m) => m.row.strength === '10 mg')?.product.id).toBe('p10')
  })
})
