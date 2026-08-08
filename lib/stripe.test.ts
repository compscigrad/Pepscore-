import { describe, expect, it } from 'vitest'
import { estimateStripeFee, estimateAchFee } from './stripe'

describe('estimateStripeFee', () => {
  it('applies 2.9% + $0.30', () => {
    expect(estimateStripeFee(100)).toBe(3.2)
  })
})

describe('estimateAchFee', () => {
  it('applies 0.8% for a small amount', () => {
    expect(estimateAchFee(100)).toBe(0.8)
  })

  it('caps at $5 for a large amount', () => {
    expect(estimateAchFee(10000)).toBe(5)
  })

  it('caps exactly at the $625 breakeven point', () => {
    expect(estimateAchFee(625)).toBe(5)
  })
})
