import { describe, it, expect } from 'vitest'
import { estimateCostCents } from './cost'

describe('estimateCostCents', () => {
  it('returns 0 for zero tokens', () => {
    expect(estimateCostCents(0, 0)).toBe(0)
  })

  it('scales with total token count', () => {
    const small = estimateCostCents(100, 100)
    const large = estimateCostCents(1000, 1000)
    expect(large).toBeGreaterThan(small)
  })

  it('never returns a negative or fractional-cent value', () => {
    const result = estimateCostCents(1, 1)
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})
