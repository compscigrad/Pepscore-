import { describe, it, expect } from 'vitest'
import { resolveFinanceRange } from './dateRanges'

// Fixed "now" so every assertion is deterministic regardless of when the
// suite runs -- 2026-08-12 (a Wednesday), matching this sprint's own date.
const NOW = new Date(2026, 7, 12, 15, 30)

describe('resolveFinanceRange', () => {
  it('defaults to THIS_MONTH when no params are given', () => {
    const range = resolveFinanceRange({}, NOW)
    expect(range.key).toBe('THIS_MONTH')
    expect(range.from).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 7, 31, 23, 59, 59, 999))
  })

  it('resolves LAST_MONTH across the month boundary', () => {
    const range = resolveFinanceRange({ range: 'LAST_MONTH' }, NOW)
    expect(range.from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 6, 31, 23, 59, 59, 999))
  })

  it('resolves LAST_MONTH across a year boundary (January -> prior December)', () => {
    const jan = new Date(2026, 0, 15)
    const range = resolveFinanceRange({ range: 'LAST_MONTH' }, jan)
    expect(range.from).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999))
  })

  it('resolves THIS_QUARTER for a month in the middle of a quarter', () => {
    // August is in Q3 (Jul-Sep)
    const range = resolveFinanceRange({ range: 'THIS_QUARTER' }, NOW)
    expect(range.from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
  })

  it('resolves THIS_YEAR to Jan 1 - Dec 31', () => {
    const range = resolveFinanceRange({ range: 'THIS_YEAR' }, NOW)
    expect(range.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999))
  })

  it('resolves a valid CUSTOM range', () => {
    const range = resolveFinanceRange({ range: 'CUSTOM', from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.key).toBe('CUSTOM')
    expect(range.from.getFullYear()).toBe(2026)
    expect(range.from.getMonth()).toBe(0)
    expect(range.from.getDate()).toBe(1)
  })

  it('falls back to THIS_MONTH when CUSTOM is requested but from/to are missing', () => {
    const range = resolveFinanceRange({ range: 'CUSTOM' }, NOW)
    expect(range.key).toBe('THIS_MONTH')
  })

  it('falls back to THIS_MONTH when CUSTOM dates are invalid', () => {
    const range = resolveFinanceRange({ range: 'CUSTOM', from: 'not-a-date', to: 'also-not-a-date' }, NOW)
    expect(range.key).toBe('THIS_MONTH')
  })
})
