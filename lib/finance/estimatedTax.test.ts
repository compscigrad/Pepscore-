import { describe, it, expect } from 'vitest'
import { computeMonthBookProfit } from './estimatedTax'

describe('computeMonthBookProfit', () => {
  it('subtracts only "other" opex, not shipping/paymentFees twice', () => {
    // estimatedGrossMargin already has shipping/paymentFees baked in
    // (netRevenue - cogs - shipping - paymentFees), so operatingExpenses
    // here represents the total across all categories, and only the
    // slice beyond shipping/paymentFees should be subtracted again.
    const result = computeMonthBookProfit({
      estimatedGrossMargin: 1000,
      operatingExpenses: 300, // includes the 50 shipping + 20 paymentFees already counted in the margin, plus 230 "other"
      shippingExpense: 50,
      paymentProcessingFees: 20,
    })
    expect(result).toBe(1000 - 230)
  })

  it('never subtracts a negative "other" opex when operatingExpenses is less than shipping+fees', () => {
    const result = computeMonthBookProfit({
      estimatedGrossMargin: 500,
      operatingExpenses: 10, // less than shipping+fees below -- otherOpex must clamp to 0, not go negative
      shippingExpense: 20,
      paymentProcessingFees: 5,
    })
    expect(result).toBe(500)
  })

  it('returns the margin unchanged when there are no operating expenses at all', () => {
    const result = computeMonthBookProfit({
      estimatedGrossMargin: 200,
      operatingExpenses: 0,
      shippingExpense: 0,
      paymentProcessingFees: 0,
    })
    expect(result).toBe(200)
  })

  it('handles a negative margin (a loss month) correctly', () => {
    const result = computeMonthBookProfit({
      estimatedGrossMargin: -100,
      operatingExpenses: 150,
      shippingExpense: 0,
      paymentProcessingFees: 0,
    })
    expect(result).toBe(-250)
  })
})
