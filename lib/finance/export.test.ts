import { describe, it, expect } from 'vitest'
import { buildQuickBooksXeroExpenseSheet } from './export'

describe('buildQuickBooksXeroExpenseSheet', () => {
  it('produces the expected header row', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([])
    expect(sheet.headers).toEqual(['Date', 'Description', 'Payee', 'Amount', 'Category', 'Memo'])
    expect(sheet.name).toBe('QuickBooks-Xero Import')
  })

  it('negates the amount, matching bank-import "money out" convention', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([
      { date: new Date('2026-07-01'), vendor: 'USPS', description: 'Postage', amount: 42.5, category: 'SHIPPING_POSTAGE', taxTreatment: 'OPERATING_EXPENSE', invoiceId: null, orderId: null },
    ])
    expect(sheet.rows[0][3]).toBe(-42.5)
  })

  it('negates even if the stored amount is already negative, never double-negating into a positive', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([
      { date: new Date('2026-07-01'), vendor: 'USPS', description: 'Postage refund', amount: -10, category: 'SHIPPING_POSTAGE', taxTreatment: 'OPERATING_EXPENSE', invoiceId: null, orderId: null },
    ])
    expect(sheet.rows[0][3]).toBe(-10)
  })

  it('falls back to description as payee when vendor is null', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([
      { date: new Date('2026-07-01'), vendor: null, description: 'Annual software renewal', amount: 100, category: 'SOFTWARE_TECHNOLOGY', taxTreatment: 'OPERATING_EXPENSE', invoiceId: null, orderId: null },
    ])
    expect(sheet.rows[0][2]).toBe('Annual software renewal')
  })

  it('title-cases the category for readability', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([
      { date: new Date('2026-07-01'), vendor: 'Vendor', description: 'x', amount: 1, category: 'SHIPPING_POSTAGE', taxTreatment: 'OPERATING_EXPENSE', invoiceId: null, orderId: null },
    ])
    expect(sheet.rows[0][4]).toBe('Shipping Postage')
  })

  it('includes invoice/order references and tax treatment in the memo when present', () => {
    const sheet = buildQuickBooksXeroExpenseSheet([
      { date: new Date('2026-07-01'), vendor: 'Vendor', description: 'x', amount: 1, category: 'OTHER_NEEDS_REVIEW', taxTreatment: 'NEEDS_ACCOUNTANT_REVIEW', invoiceId: 'inv_1', orderId: null },
    ])
    expect(sheet.rows[0][5]).toBe('Invoice inv_1 | Tax treatment: Needs Accountant Review')
  })
})
