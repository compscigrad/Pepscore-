import { describe, it, expect } from 'vitest'
import { STOREFRONT_BACKORDER_CREDIT_AMOUNT, STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL } from './backorderPolicy'
import { BACKORDER_COMPENSATION_AMOUNT } from '../backorders'
import { BACKORDER_AUTOMATIC_MINIMUM_ORDER_TOTAL } from '../invoice/backorder'

// These values are deliberately duplicated into a client-safe file (see
// backorderPolicy.ts's comment) since the authoritative constants live in
// server-only modules that can't be imported into a client component. This
// test is the guard against the two ever drifting apart silently.
describe('storefront backorder policy constants stay in sync with the authoritative service', () => {
  it('credit amount matches lib/backorders.ts', () => {
    expect(STOREFRONT_BACKORDER_CREDIT_AMOUNT).toBe(BACKORDER_COMPENSATION_AMOUNT)
  })

  it('minimum order total matches lib/invoice/backorder.ts', () => {
    expect(STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL).toBe(BACKORDER_AUTOMATIC_MINIMUM_ORDER_TOTAL)
  })
})
