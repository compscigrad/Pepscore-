import { describe, it, expect } from 'vitest'
import { isCostLimitExceeded } from './track'

describe('isCostLimitExceeded', () => {
  it('is not exceeded when spend is below the limit', () => {
    expect(isCostLimitExceeded(50, 100)).toBe(false)
  })

  it('is exceeded when spend equals the limit (fail closed at the boundary, not just past it)', () => {
    expect(isCostLimitExceeded(100, 100)).toBe(true)
  })

  it('is exceeded when spend is above the limit', () => {
    expect(isCostLimitExceeded(150, 100)).toBe(true)
  })

  it('treats a zero limit as always exceeded once any spend occurs', () => {
    expect(isCostLimitExceeded(1, 0)).toBe(true)
    expect(isCostLimitExceeded(0, 0)).toBe(true)
  })
})
