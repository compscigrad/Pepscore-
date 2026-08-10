import { describe, it, expect } from 'vitest'
import { normalizePromotionCode, computeDiscountAmount } from './redemption'

describe('normalizePromotionCode', () => {
  it('uppercases and trims', () => {
    expect(normalizePromotionCode('  first10  ')).toBe('FIRST10')
  })

  it('is idempotent on an already-normalized code', () => {
    expect(normalizePromotionCode('WELCOME10')).toBe('WELCOME10')
  })
})

describe('computeDiscountAmount', () => {
  it('computes a percentage discount correctly', () => {
    expect(computeDiscountAmount('PERCENTAGE', 10, 200)).toBe(20)
  })

  it('computes a fixed discount correctly', () => {
    expect(computeDiscountAmount('FIXED', 15, 200)).toBe(15)
  })

  it('never discounts below the subtotal itself -- a fixed amount larger than the cart caps at the cart total', () => {
    expect(computeDiscountAmount('FIXED', 50, 20)).toBe(20)
  })

  it('never discounts below the subtotal for a percentage over 100 (defensive, shouldn\'t occur but must not go negative)', () => {
    expect(computeDiscountAmount('PERCENTAGE', 150, 50)).toBe(50)
  })

  it('never produces a negative discount for a zero subtotal', () => {
    expect(computeDiscountAmount('FIXED', 10, 0)).toBe(0)
  })
})
