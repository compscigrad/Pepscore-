import { describe, it, expect } from 'vitest'
import { lineItemTotal, itemsTotal, resolveDiscountAmount, discountTotal, calculateInvoiceTotals } from './calculations'

describe('lineItemTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineItemTotal({ quantity: 3, unitPrice: 10 })).toBe(30)
  })

  it('subtracts a line-level discount', () => {
    expect(lineItemTotal({ quantity: 2, unitPrice: 50, lineDiscount: 15 })).toBe(85)
  })

  it('never goes negative -- a discount larger than the line value clamps to 0', () => {
    expect(lineItemTotal({ quantity: 1, unitPrice: 10, lineDiscount: 100 })).toBe(0)
  })

  it('treats an omitted lineDiscount as 0', () => {
    expect(lineItemTotal({ quantity: 1, unitPrice: 25 })).toBe(25)
  })

  it('rounds to 2 decimal places, guarding against floating-point drift', () => {
    expect(lineItemTotal({ quantity: 3, unitPrice: 0.1 })).toBe(0.3)
  })
})

describe('itemsTotal', () => {
  it('sums lineItemTotal across all items', () => {
    const items = [{ quantity: 2, unitPrice: 10 }, { quantity: 1, unitPrice: 25 }]
    expect(itemsTotal(items)).toBe(45)
  })

  it('returns 0 for an empty item list', () => {
    expect(itemsTotal([])).toBe(0)
  })

  it('accounts for per-line discounts in the sum', () => {
    const items = [{ quantity: 1, unitPrice: 100, lineDiscount: 20 }, { quantity: 1, unitPrice: 50 }]
    expect(itemsTotal(items)).toBe(130)
  })
})

describe('resolveDiscountAmount', () => {
  it('FIXED discount returns the flat amount regardless of items total', () => {
    expect(resolveDiscountAmount({ type: 'FIXED', amount: 25 }, 1000)).toBe(25)
  })

  it('PERCENTAGE discount computes against the pre-shipping items total', () => {
    expect(resolveDiscountAmount({ type: 'PERCENTAGE', amount: 10 }, 200)).toBe(20)
  })

  it('a 100% discount zeroes out the items total exactly', () => {
    expect(resolveDiscountAmount({ type: 'PERCENTAGE', amount: 100 }, 150)).toBe(150)
  })

  it('rounds a percentage result to 2 decimal places', () => {
    expect(resolveDiscountAmount({ type: 'PERCENTAGE', amount: 33.33 }, 10)).toBeCloseTo(3.33, 2)
  })
})

describe('discountTotal', () => {
  it('sums multiple discounts additively, not compounded', () => {
    // Two 10% discounts against a $200 items total: 20 + 20 = 40, NOT
    // 200 * 0.9 * 0.9 (compounded would be 38).
    const discounts = [
      { type: 'PERCENTAGE' as const, amount: 10 },
      { type: 'PERCENTAGE' as const, amount: 10 },
    ]
    expect(discountTotal(discounts, 200)).toBe(40)
  })

  it('mixes FIXED and PERCENTAGE discounts', () => {
    const discounts = [
      { type: 'FIXED' as const, amount: 15 },
      { type: 'PERCENTAGE' as const, amount: 10 },
    ]
    expect(discountTotal(discounts, 100)).toBe(25)
  })

  it('returns 0 for no discounts', () => {
    expect(discountTotal([], 100)).toBe(0)
  })
})

describe('calculateInvoiceTotals', () => {
  it('computes the full pipeline: items + shipping - discounts - paid = balance due', () => {
    const items = [{ quantity: 2, unitPrice: 100 }] // itemsTotal = 200
    const discounts = [{ type: 'PERCENTAGE' as const, amount: 10 }] // 20
    const result = calculateInvoiceTotals(items, discounts, 15, 100)
    // subtotal = 200 + 15 = 215
    // total = 215 - 20 = 195
    // balanceDue = 195 - 100 = 95
    expect(result).toEqual({ itemsTotal: 200, subtotal: 215, discountTotal: 20, total: 195, balanceDue: 95 })
  })

  it('total never goes negative even if discounts exceed the subtotal', () => {
    const items = [{ quantity: 1, unitPrice: 10 }]
    const discounts = [{ type: 'FIXED' as const, amount: 1000 }]
    const result = calculateInvoiceTotals(items, discounts, 0, 0)
    expect(result.total).toBe(0)
  })

  it('a fully-paid invoice has a 0 balance due', () => {
    const items = [{ quantity: 1, unitPrice: 100 }]
    const result = calculateInvoiceTotals(items, [], 0, 100)
    expect(result.balanceDue).toBe(0)
  })

  it('an overpayment produces a negative balance due (credit owed), not clamped to 0', () => {
    const items = [{ quantity: 1, unitPrice: 100 }]
    const result = calculateInvoiceTotals(items, [], 0, 150)
    expect(result.balanceDue).toBe(-50)
  })

  it('percentage discount is computed against items total, unaffected by shipping cost', () => {
    const items = [{ quantity: 1, unitPrice: 100 }]
    const discounts = [{ type: 'PERCENTAGE' as const, amount: 10 }]
    const withShipping = calculateInvoiceTotals(items, discounts, 50, 0)
    // discountTotal must be 10 (10% of 100 items total), not 10% of the 150 subtotal (15)
    expect(withShipping.discountTotal).toBe(10)
  })
})
