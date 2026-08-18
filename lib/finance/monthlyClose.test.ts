import { describe, it, expect } from 'vitest'
import { isChecklistComplete } from './monthlyClose'

describe('isChecklistComplete', () => {
  it('returns true only when every checklist item is explicitly true', () => {
    expect(
      isChecklistComplete({
        ordersReconciled: true,
        paymentsReconciled: true,
        refundsReconciled: true,
        shippingReconciled: true,
        expensesEntered: true,
        receiptsReviewed: true,
        salesTaxReviewed: true,
        bankReconciled: true,
      })
    ).toBe(true)
  })

  it('returns false when any single item is missing or false', () => {
    expect(
      isChecklistComplete({
        ordersReconciled: true,
        paymentsReconciled: true,
        refundsReconciled: true,
        shippingReconciled: true,
        expensesEntered: true,
        receiptsReviewed: true,
        salesTaxReviewed: false,
        bankReconciled: true,
      })
    ).toBe(false)
  })

  it('returns false for an empty checklist', () => {
    expect(isChecklistComplete({})).toBe(false)
  })
})
