import { describe, it, expect } from 'vitest'
import { isInvoiceEmailTriggerStatus } from './invoiceIssuedEmail'

describe('isInvoiceEmailTriggerStatus', () => {
  it('triggers on ISSUED', () => {
    expect(isInvoiceEmailTriggerStatus('ISSUED')).toBe(true)
  })

  // PENDING now means "issued, with a positive balance" (see
  // lib/invoice/status.ts) — it must trigger the same as ISSUED, since both
  // represent "this invoice has been issued at least once."
  it('triggers on PENDING', () => {
    expect(isInvoiceEmailTriggerStatus('PENDING')).toBe(true)
  })

  it('does not trigger on DRAFT', () => {
    expect(isInvoiceEmailTriggerStatus('DRAFT')).toBe(false)
  })

  it('does not trigger on CANCELLED, REFUNDED, or VOID', () => {
    expect(isInvoiceEmailTriggerStatus('CANCELLED')).toBe(false)
    expect(isInvoiceEmailTriggerStatus('REFUNDED')).toBe(false)
    expect(isInvoiceEmailTriggerStatus('VOID')).toBe(false)
  })
})
