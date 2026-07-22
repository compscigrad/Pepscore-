import { describe, it, expect } from 'vitest'
import { isInvoiceEmailTriggerStatus } from './invoiceIssuedEmail'

describe('isInvoiceEmailTriggerStatus', () => {
  it('triggers on ISSUED', () => {
    expect(isInvoiceEmailTriggerStatus('ISSUED')).toBe(true)
  })

  it('triggers on PAID', () => {
    expect(isInvoiceEmailTriggerStatus('PAID')).toBe(true)
  })

  it('triggers on PARTIALLY_PAID', () => {
    expect(isInvoiceEmailTriggerStatus('PARTIALLY_PAID')).toBe(true)
  })

  it('does not trigger on DRAFT', () => {
    expect(isInvoiceEmailTriggerStatus('DRAFT')).toBe(false)
  })

  it('does not trigger on PENDING or APPROVED', () => {
    expect(isInvoiceEmailTriggerStatus('PENDING')).toBe(false)
    expect(isInvoiceEmailTriggerStatus('APPROVED')).toBe(false)
  })

  it('does not trigger on CANCELLED, REFUNDED, or VOID', () => {
    expect(isInvoiceEmailTriggerStatus('CANCELLED')).toBe(false)
    expect(isInvoiceEmailTriggerStatus('REFUNDED')).toBe(false)
    expect(isInvoiceEmailTriggerStatus('VOID')).toBe(false)
  })
})
