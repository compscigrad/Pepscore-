import { describe, expect, it } from 'vitest'
import { estimateStripeFee, estimateAchFee, resolvePaymentFee, type RealStripeFee } from './stripe'

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

describe('resolvePaymentFee', () => {
  it('successful payment with a Stripe fee: uses the REAL balance-transaction fee/net when available, never the estimate', () => {
    // $100 charge, Stripe's real fee is $3.20 (would coincidentally match
    // the 2.9%+$0.30 estimate here) but the point is it comes from `real`,
    // not from calling estimateStripeFee -- proven by using a real net
    // that would NOT match amountTotal - fee if the estimate path had run.
    const real: RealStripeFee = { fee: 3.2, net: 96.8, balanceTransactionId: 'txn_real' }
    const result = resolvePaymentFee(real, 'CARD', 100)
    expect(result).toEqual({ fee: 3.2, net: 96.8, stripeFeeIsEstimated: false })
  })

  it('a real fee that genuinely differs from the published-rate estimate is still trusted as-is', () => {
    // Proves the function never "corrects" a real Stripe figure toward
    // the estimate -- e.g. a card with a different interchange rate.
    const real: RealStripeFee = { fee: 4.75, net: 95.25, balanceTransactionId: 'txn_real2' }
    const result = resolvePaymentFee(real, 'CARD', 100)
    expect(result.fee).toBe(4.75) // NOT estimateStripeFee(100) = 3.20
    expect(result.stripeFeeIsEstimated).toBe(false)
  })

  it('falls back to the published-rate CARD estimate and flags it as estimated when no real fee is available', () => {
    const result = resolvePaymentFee(null, 'CARD', 100)
    expect(result).toEqual({ fee: 3.2, net: 96.8, stripeFeeIsEstimated: true })
  })

  it('falls back to the published-rate ACH estimate and flags it as estimated when no real fee is available', () => {
    const result = resolvePaymentFee(null, 'ACH', 100)
    expect(result).toEqual({ fee: 0.8, net: 99.2, stripeFeeIsEstimated: true })
  })
})
