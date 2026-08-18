import { describe, it, expect } from 'vitest'
import { aggregateCategoryPerformance, categoriesWithNoEngagement } from './categoryPerformance'

describe('aggregateCategoryPerformance', () => {
  it('returns an empty array for no events -- never fabricates demand', () => {
    expect(aggregateCategoryPerformance([])).toEqual([])
  })

  it('counts a view toward every merchandising category the product belongs to', () => {
    // GHK-Cu belongs to both recovery-injury-research and skin-hair-cosmetic.
    const result = aggregateCategoryPerformance([{ productName: 'GHK-Cu', eventType: 'VIEW' }])
    const slugs = result.map((r) => r.slug)
    expect(slugs).toContain('recovery-injury-research')
    expect(slugs).toContain('skin-hair-cosmetic')
    expect(result.every((r) => r.views === 1)).toBe(true)
  })

  it('excludes a category with zero views even if an unrelated product had adds-to-cart', () => {
    const result = aggregateCategoryPerformance([{ productName: 'not-a-real-product', eventType: 'ADD_TO_CART' }])
    expect(result).toEqual([])
  })

  it('computes a real view-to-cart rate, never divide-by-zero', () => {
    const result = aggregateCategoryPerformance([
      { productName: 'NAD+', eventType: 'VIEW' },
      { productName: 'NAD+', eventType: 'VIEW' },
      { productName: 'NAD+', eventType: 'ADD_TO_CART' },
    ])
    const row = result.find((r) => r.slug === 'anti-aging-longevity')
    expect(row).toBeDefined()
    expect(row!.views).toBe(2)
    expect(row!.addsToCart).toBe(1)
    expect(row!.viewToCartRate).toBe(0.5)
  })

  it('sorts by views descending', () => {
    const result = aggregateCategoryPerformance([
      { productName: 'PT-141', eventType: 'VIEW' },
      { productName: 'Semax', eventType: 'VIEW' },
      { productName: 'Semax', eventType: 'VIEW' },
    ])
    expect(result[0].slug).toBe('brain-mood-cognitive')
  })
})

describe('categoriesWithNoEngagement', () => {
  it('lists every taxonomy category not present in the performance result', () => {
    const noEngagement = categoriesWithNoEngagement([])
    expect(noEngagement.length).toBeGreaterThan(0)
    expect(noEngagement).toContain('Reproductive / Hormonal Research')
  })

  it('excludes a category once it has any recorded engagement', () => {
    const performance = aggregateCategoryPerformance([{ productName: 'NAD+', eventType: 'VIEW' }])
    const noEngagement = categoriesWithNoEngagement(performance)
    expect(noEngagement).not.toContain('Cellular Aging / Longevity Research')
  })
})
