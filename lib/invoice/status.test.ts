import { describe, it, expect } from 'vitest'
import {
  deriveInvoicePaymentAmounts,
  deriveInvoiceWorkflowStatus,
  deriveInitialPaymentIntentStatus,
  resolvePaymentIntentAfterPayment,
  recommendInstallmentCount,
} from './status'

describe('deriveInvoicePaymentAmounts', () => {
  it('is UNPAID with the full balance due when nothing has been paid', () => {
    expect(deriveInvoicePaymentAmounts(0, 500)).toEqual({ paymentStatus: 'UNPAID', balanceDue: 500, overpaidAmount: 0 })
  })

  it('is PARTIALLY_PAID with the remaining balance when some has been paid', () => {
    expect(deriveInvoicePaymentAmounts(200, 500)).toEqual({ paymentStatus: 'PARTIALLY_PAID', balanceDue: 300, overpaidAmount: 0 })
  })

  it('is PAID with zero balance due when the full amount has been paid', () => {
    expect(deriveInvoicePaymentAmounts(500, 500)).toEqual({ paymentStatus: 'PAID', balanceDue: 0, overpaidAmount: 0 })
  })

  it('never produces a negative balance due on overpayment — surfaces the excess separately', () => {
    expect(deriveInvoicePaymentAmounts(550, 500)).toEqual({ paymentStatus: 'PAID', balanceDue: 0, overpaidAmount: 50 })
  })

  it('rounds away floating-point artifacts (0.3 - 0.1 !== 0.2 in raw JS)', () => {
    expect(deriveInvoicePaymentAmounts(0.1, 0.3)).toEqual({ paymentStatus: 'PARTIALLY_PAID', balanceDue: 0.2, overpaidAmount: 0 })
  })
})

describe('deriveInvoiceWorkflowStatus', () => {
  it('stays DRAFT until the invoice has ever been issued', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'DRAFT', hasBeenIssued: false, balanceDue: 500 })).toBe('DRAFT')
  })

  it('is PENDING once issued with any positive balance, no payment at all', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'ISSUED', hasBeenIssued: true, balanceDue: 500 })).toBe('PENDING')
  })

  it('is PENDING once issued with a positive balance after a partial payment', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'PENDING', hasBeenIssued: true, balanceDue: 200 })).toBe('PENDING')
  })

  it('is PENDING regardless of an approved arrangement, as long as balance remains', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'PENDING', hasBeenIssued: true, balanceDue: 100 })).toBe('PENDING')
  })

  it('returns to ISSUED the moment balance due reaches $0', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'PENDING', hasBeenIssued: true, balanceDue: 0 })).toBe('ISSUED')
  })

  it('is ISSUED immediately when paid in full before issuance (balance already $0)', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'DRAFT', hasBeenIssued: true, balanceDue: 0 })).toBe('ISSUED')
  })

  it('never overrides a terminal status (CANCELLED/REFUNDED/VOID), even with a positive balance', () => {
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'CANCELLED', hasBeenIssued: true, balanceDue: 500 })).toBe('CANCELLED')
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'REFUNDED', hasBeenIssued: true, balanceDue: 0 })).toBe('REFUNDED')
    expect(deriveInvoiceWorkflowStatus({ currentStatus: 'VOID', hasBeenIssued: true, balanceDue: 500 })).toBe('VOID')
  })
})

describe('deriveInitialPaymentIntentStatus', () => {
  it('is AWAITING_CLIENT_SELECTION when a balance remains at issuance (branches A & B)', () => {
    expect(deriveInitialPaymentIntentStatus(500)).toBe('AWAITING_CLIENT_SELECTION')
  })

  it('is NOT_AVAILABLE when paid in full before issuance (branch C) — no selection needed', () => {
    expect(deriveInitialPaymentIntentStatus(0)).toBe('NOT_AVAILABLE')
  })
})

describe('resolvePaymentIntentAfterPayment', () => {
  it('leaves the intent unchanged while a balance remains', () => {
    expect(resolvePaymentIntentAfterPayment('AWAITING_MANUAL_CONFIRMATION', 100)).toBe('AWAITING_MANUAL_CONFIRMATION')
  })

  it('confirms a pay-in-full selection once the balance is fully paid', () => {
    expect(resolvePaymentIntentAfterPayment('AWAITING_MANUAL_CONFIRMATION', 0)).toBe('CONFIRMED')
  })

  it('confirms an approved arrangement once the final installment brings balance to $0', () => {
    expect(resolvePaymentIntentAfterPayment('ARRANGEMENT_APPROVED', 0)).toBe('CONFIRMED')
  })

  it('resets an awaiting-selection invoice to Not Available if paid off with no selection ever made', () => {
    expect(resolvePaymentIntentAfterPayment('AWAITING_CLIENT_SELECTION', 0)).toBe('NOT_AVAILABLE')
  })

  it('leaves Not Available as Not Available (e.g. paid in full before issuance, then... already $0)', () => {
    expect(resolvePaymentIntentAfterPayment('NOT_AVAILABLE', 0)).toBe('NOT_AVAILABLE')
  })
})

describe('recommendInstallmentCount', () => {
  it('recommends 0 for a zero or negative balance', () => {
    expect(recommendInstallmentCount(0)).toBe(0)
    expect(recommendInstallmentCount(-10)).toBe(0)
  })

  it('recommends at most 3 payments for a balance of exactly $1,000', () => {
    expect(recommendInstallmentCount(1000)).toBe(3)
  })

  it('recommends at most 3 payments for a balance under $1,000', () => {
    expect(recommendInstallmentCount(600)).toBe(3)
  })

  it('recommends up to 4 payments for a balance just over $1,000', () => {
    expect(recommendInstallmentCount(1000.01)).toBe(4)
  })

  it('recommends up to 4 payments for a large balance', () => {
    expect(recommendInstallmentCount(1300)).toBe(4)
  })
})
