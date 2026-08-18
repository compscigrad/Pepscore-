import { describe, it, expect } from 'vitest'
import { aggregateZeroResultQueries, aggregateTopQueries } from './searchInsights'

describe('aggregateZeroResultQueries', () => {
  it('groups by normalized (trimmed, lowercased) query text', () => {
    const events = [
      { query: 'MOTS-c', createdAt: new Date('2026-08-01') },
      { query: ' mots-c ', createdAt: new Date('2026-08-02') },
      { query: 'mots-c', createdAt: new Date('2026-08-03') },
    ]
    const result = aggregateZeroResultQueries(events)
    expect(result).toHaveLength(1)
    expect(result[0].query).toBe('mots-c')
    expect(result[0].count).toBe(3)
  })

  it('tracks the most recent search timestamp per query', () => {
    const events = [
      { query: 'ara-290', createdAt: new Date('2026-08-01') },
      { query: 'ara-290', createdAt: new Date('2026-08-10') },
      { query: 'ara-290', createdAt: new Date('2026-08-05') },
    ]
    const result = aggregateZeroResultQueries(events)
    expect(result[0].lastSearchedAt).toEqual(new Date('2026-08-10'))
  })

  it('sorts by count descending', () => {
    const events = [
      { query: 'a', createdAt: new Date() },
      { query: 'b', createdAt: new Date() },
      { query: 'b', createdAt: new Date() },
      { query: 'b', createdAt: new Date() },
    ]
    const result = aggregateZeroResultQueries(events)
    expect(result[0].query).toBe('b')
    expect(result[0].count).toBe(3)
    expect(result[1].query).toBe('a')
  })

  it('respects the limit', () => {
    const events = Array.from({ length: 30 }, (_, i) => ({ query: `q${i}`, createdAt: new Date() }))
    const result = aggregateZeroResultQueries(events, 5)
    expect(result).toHaveLength(5)
  })

  it('returns an empty array for no events -- never fabricates a result', () => {
    expect(aggregateZeroResultQueries([])).toEqual([])
  })

  it('ignores blank/whitespace-only queries', () => {
    const events = [{ query: '   ', createdAt: new Date() }]
    expect(aggregateZeroResultQueries(events)).toEqual([])
  })
})

describe('aggregateTopQueries', () => {
  it('counts normalized query frequency', () => {
    const events = [{ query: 'Semaglutide' }, { query: 'semaglutide' }, { query: 'Tirzepatide' }]
    const result = aggregateTopQueries(events)
    expect(result[0]).toEqual({ query: 'semaglutide', count: 2 })
    expect(result[1]).toEqual({ query: 'tirzepatide', count: 1 })
  })

  it('returns an empty array for no events', () => {
    expect(aggregateTopQueries([])).toEqual([])
  })
})
