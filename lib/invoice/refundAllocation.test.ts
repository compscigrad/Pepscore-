import { describe, it, expect } from 'vitest'
import { allocateInvoiceDiscount, remainingRefundableForItem, remainingRefundableForInvoice, quantityRefundAmount } from './refundAllocation'

describe('allocateInvoiceDiscount', () => {
  // CASE 1 (owner spec): 2 x $100 lines, $50 invoice discount, refund one
  // line -> expected merchandise refund = $75. Equal-value lines happen to
  // match discount/lineCount here, but the implementation must arrive at
  // it via proportional share, not a lineCount divide -- confirmed by
  // CASE 2/3 below using unequal lines.
  it('splits a discount evenly across equal-value lines (CASE 1)', () => {
    const result = allocateInvoiceDiscount(
      [
        { id: 'a', total: 100, quantity: 1 },
        { id: 'b', total: 100, quantity: 1 },
      ],
      50
    )
    const a = result.find((r) => r.itemId === 'a')!
    const b = result.find((r) => r.itemId === 'b')!
    expect(a.allocatedDiscount).toBe(25)
    expect(a.effectivePaidValue).toBe(75)
    expect(b.allocatedDiscount).toBe(25)
    expect(b.effectivePaidValue).toBe(75)
  })

  // CASE 2 + CASE 3 (owner spec): $100 + $300 lines, $100 invoice
  // discount. Product A (25% of merchandise) -> $75 effective. Product B
  // (75% of merchandise) -> $225 effective.
  it('allocates proportionally to unequal-value lines (CASE 2/3)', () => {
    const result = allocateInvoiceDiscount(
      [
        { id: 'a', total: 100, quantity: 1 },
        { id: 'b', total: 300, quantity: 1 },
      ],
      100
    )
    const a = result.find((r) => r.itemId === 'a')!
    const b = result.find((r) => r.itemId === 'b')!
    expect(a.allocatedDiscount).toBe(25)
    expect(a.effectivePaidValue).toBe(75)
    expect(b.allocatedDiscount).toBe(75)
    expect(b.effectivePaidValue).toBe(225)
    // The full discount is accounted for exactly, not silently rounded away.
    expect(a.allocatedDiscount + b.allocatedDiscount).toBe(100)
  })

  it('reconciles rounding remainder across three unevenly-priced lines without losing or double-counting a cent', () => {
    // $10 discount across three lines whose shares (1/3 each of $100)
    // don't divide evenly into cents -- every implementation of naive
    // per-item rounding risks the sum landing at $9.99 or $10.01.
    const result = allocateInvoiceDiscount(
      [
        { id: 'a', total: 100, quantity: 1 },
        { id: 'b', total: 100, quantity: 1 },
        { id: 'c', total: 100, quantity: 1 },
      ],
      10
    )
    const sum = result.reduce((s, r) => s + r.allocatedDiscount, 0)
    expect(Math.round(sum * 100) / 100).toBe(10)
  })

  it('never allocates more discount to an item than the item is worth, even if the invoice discount exceeds merchandise total', () => {
    const result = allocateInvoiceDiscount([{ id: 'a', total: 50, quantity: 1 }], 500)
    expect(result[0].allocatedDiscount).toBe(50)
    expect(result[0].effectivePaidValue).toBe(0)
  })

  it('returns full gross value as effective paid value when there is no discount', () => {
    const result = allocateInvoiceDiscount([{ id: 'a', total: 100, quantity: 1 }], 0)
    expect(result[0].allocatedDiscount).toBe(0)
    expect(result[0].effectivePaidValue).toBe(100)
  })

  it('returns an empty array for an empty item list', () => {
    expect(allocateInvoiceDiscount([], 50)).toEqual([])
  })
})

describe('remainingRefundableForItem', () => {
  it('returns the full effective value when nothing has been refunded yet', () => {
    expect(remainingRefundableForItem(75, [])).toBe(75)
  })

  // CASE 5 (owner spec): one line already partially refunded, a second
  // refund must respect the remaining cap.
  it('subtracts prior refund claims from the effective value', () => {
    expect(remainingRefundableForItem(75, [30])).toBe(45)
  })

  it('never goes negative even if prior claims exceed the effective value (a pre-existing data anomaly, not masked as a negative number)', () => {
    expect(remainingRefundableForItem(75, [50, 40])).toBe(0)
  })
})

describe('remainingRefundableForInvoice', () => {
  it('returns amountPaid minus amountRefunded when nothing is pending', () => {
    expect(remainingRefundableForInvoice(200, 0, [])).toBe(200)
  })

  // CASE 6 (owner spec): full invoice refund after a prior partial refund
  // should only return the remaining refundable balance.
  it('subtracts already-completed refunds', () => {
    expect(remainingRefundableForInvoice(200, 75, [])).toBe(125)
  })

  it('also subtracts in-flight pending refund requests, not just completed ones', () => {
    expect(remainingRefundableForInvoice(200, 75, [50])).toBe(75)
  })

  it('never goes negative', () => {
    expect(remainingRefundableForInvoice(100, 80, [50])).toBe(0)
  })
})

describe('quantityRefundAmount', () => {
  // CASE 4 (owner spec): multiple quantities on one line, partial
  // quantity refund.
  it('computes a per-unit share of the effective paid value', () => {
    // 2 units, $150 effective (after allocation) -> $75/unit.
    expect(quantityRefundAmount(150, 2, 1)).toBe(75)
    expect(quantityRefundAmount(150, 2, 2)).toBe(150)
  })

  it('handles a non-evenly-divisible per-unit price without drifting on repeated calls', () => {
    // $100 effective / 3 units = $33.333... per unit.
    expect(quantityRefundAmount(100, 3, 1)).toBe(33.33)
    expect(quantityRefundAmount(100, 3, 2)).toBe(66.67)
    expect(quantityRefundAmount(100, 3, 3)).toBe(100)
  })

  it('returns 0 for a zero-quantity line rather than dividing by zero', () => {
    expect(quantityRefundAmount(100, 0, 1)).toBe(0)
  })
})
