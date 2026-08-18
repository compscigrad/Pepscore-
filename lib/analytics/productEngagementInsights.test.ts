import { describe, it, expect } from 'vitest'
import { aggregateEngagement } from './productEngagementInsights'

describe('aggregateEngagement', () => {
  it('counts views and add-to-carts per product', () => {
    const events = [
      { productId: 'p1', productName: 'Semaglutide', eventType: 'VIEW' as const },
      { productId: 'p1', productName: 'Semaglutide', eventType: 'VIEW' as const },
      { productId: 'p1', productName: 'Semaglutide', eventType: 'ADD_TO_CART' as const },
    ]
    const result = aggregateEngagement(events)
    expect(result[0]).toEqual({ productId: 'p1', productName: 'Semaglutide', views: 2, addsToCart: 1, viewToCartRate: 0.5 })
  })

  it('excludes a product with adds-to-cart but zero recorded views (no fabricated rate)', () => {
    const events = [{ productId: 'p1', productName: 'X', eventType: 'ADD_TO_CART' as const }]
    const result = aggregateEngagement(events)
    expect(result).toEqual([])
  })

  it('sorts by view count descending', () => {
    const events = [
      { productId: 'a', productName: 'A', eventType: 'VIEW' as const },
      { productId: 'b', productName: 'B', eventType: 'VIEW' as const },
      { productId: 'b', productName: 'B', eventType: 'VIEW' as const },
      { productId: 'b', productName: 'B', eventType: 'VIEW' as const },
    ]
    const result = aggregateEngagement(events)
    expect(result[0].productId).toBe('b')
    expect(result[1].productId).toBe('a')
  })

  it('respects the limit', () => {
    const events = Array.from({ length: 30 }, (_, i) => ({ productId: `p${i}`, productName: `P${i}`, eventType: 'VIEW' as const }))
    expect(aggregateEngagement(events, 5)).toHaveLength(5)
  })

  it('returns an empty array for no events', () => {
    expect(aggregateEngagement([])).toEqual([])
  })

  it('a product with views but no adds has a 0 rate, not omitted', () => {
    const events = [{ productId: 'p1', productName: 'X', eventType: 'VIEW' as const }]
    const result = aggregateEngagement(events)
    expect(result[0].viewToCartRate).toBe(0)
  })
})
