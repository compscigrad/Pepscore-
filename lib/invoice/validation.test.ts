import { describe, it, expect } from 'vitest'
import { assertPaymentWithinBalance, addressSchema, invoicePayloadSchema, paymentPayloadSchema } from './validation'

describe('assertPaymentWithinBalance', () => {
  it('allows a payment less than the balance due', () => {
    expect(() => assertPaymentWithinBalance(50, 100)).not.toThrow()
  })

  it('allows a payment exactly equal to the balance due', () => {
    expect(() => assertPaymentWithinBalance(100, 100)).not.toThrow()
  })

  it('allows a payment within the 0.005 floating-point tolerance', () => {
    expect(() => assertPaymentWithinBalance(100.004, 100)).not.toThrow()
  })

  it('throws when a payment exceeds the balance due beyond tolerance', () => {
    expect(() => assertPaymentWithinBalance(150, 100)).toThrow(/exceeds the remaining balance/)
  })

  it('the thrown message reports both amounts to 2 decimal places', () => {
    expect(() => assertPaymentWithinBalance(150, 100)).toThrow('$150.00')
  })
})

describe('addressSchema', () => {
  const base = { street1: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' }

  it('accepts a valid 5-digit ZIP', () => {
    expect(addressSchema.safeParse(base).success).toBe(true)
  })

  it('accepts a valid ZIP+4', () => {
    expect(addressSchema.safeParse({ ...base, zip: '90210-1234' }).success).toBe(true)
  })

  it('rejects a malformed ZIP', () => {
    expect(addressSchema.safeParse({ ...base, zip: 'not-a-zip' }).success).toBe(false)
  })

  it('rejects a missing street address', () => {
    expect(addressSchema.safeParse({ ...base, street1: '' }).success).toBe(false)
  })

  it('defaults country to US when omitted', () => {
    const result = addressSchema.safeParse(base)
    expect(result.success && result.data.country).toBe('US')
  })
})

describe('invoicePayloadSchema', () => {
  const validItem = { name: 'Test Product', quantity: 1, unitPrice: 50, lineDiscount: 0, sortOrder: 0 }
  const base = { customerName: 'Jane Doe', items: [validItem] }

  it('accepts a minimal valid payload', () => {
    expect(invoicePayloadSchema.safeParse(base).success).toBe(true)
  })

  it('requires at least one line item', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, items: [] }).success).toBe(false)
  })

  it('rejects a line item with zero or negative quantity', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, items: [{ ...validItem, quantity: 0 }] }).success).toBe(false)
    expect(invoicePayloadSchema.safeParse({ ...base, items: [{ ...validItem, quantity: -1 }] }).success).toBe(false)
  })

  it('rejects a line item with a negative unit price', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, items: [{ ...validItem, unitPrice: -5 }] }).success).toBe(false)
  })

  it('rejects a missing customer name', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, customerName: '' }).success).toBe(false)
  })

  it('rejects an invalid customer email when one is provided', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, customerEmail: 'not-an-email' }).success).toBe(false)
  })

  it('accepts an empty-string customer email (optional field)', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, customerEmail: '' }).success).toBe(true)
  })

  it('defaults status to DRAFT and shippingCost to 0', () => {
    const result = invoicePayloadSchema.safeParse(base)
    expect(result.success && result.data.status).toBe('DRAFT')
    expect(result.success && result.data.shippingCost).toBe(0)
  })

  it('rejects PENDING as a settable status (never admin-settable)', () => {
    expect(invoicePayloadSchema.safeParse({ ...base, status: 'PENDING' }).success).toBe(false)
  })

  describe('custom discount label (2026-09-03: no longer required to save)', () => {
    const withDiscount = (label?: string) => ({
      ...base,
      discounts: [{ label, type: 'FIXED' as const, amount: 25 }],
    })

    it('accepts a discount with no label at all, and stores "Miscellaneous"', () => {
      const result = invoicePayloadSchema.safeParse(withDiscount(undefined))
      expect(result.success).toBe(true)
      expect(result.success && result.data.discounts[0].label).toBe('Miscellaneous')
    })

    it('accepts a blank/whitespace-only label, and stores "Miscellaneous"', () => {
      const result = invoicePayloadSchema.safeParse(withDiscount('   '))
      expect(result.success).toBe(true)
      expect(result.success && result.data.discounts[0].label).toBe('Miscellaneous')
    })

    it('preserves an owner-provided label untouched (trimmed)', () => {
      const result = invoicePayloadSchema.safeParse(withDiscount('  Courtesy Discount  '))
      expect(result.success).toBe(true)
      expect(result.success && result.data.discounts[0].label).toBe('Courtesy Discount')
    })

    it('still rejects a negative discount amount', () => {
      expect(invoicePayloadSchema.safeParse({ ...base, discounts: [{ label: 'X', type: 'FIXED', amount: -5 }] }).success).toBe(false)
    })

    it('rejects a percentage discount over 100%', () => {
      expect(invoicePayloadSchema.safeParse({ ...base, discounts: [{ label: 'X', type: 'PERCENTAGE', amount: 150 }] }).success).toBe(false)
    })

    it('accepts a percentage discount of exactly 100%', () => {
      expect(invoicePayloadSchema.safeParse({ ...base, discounts: [{ label: 'X', type: 'PERCENTAGE', amount: 100 }] }).success).toBe(true)
    })

    it('rejects a line discount exceeding the line’s own price (quantity × unit price)', () => {
      const overDiscounted = { ...base, items: [{ ...validItem, quantity: 1, unitPrice: 50, lineDiscount: 75 }] }
      expect(invoicePayloadSchema.safeParse(overDiscounted).success).toBe(false)
    })

    it('accepts a line discount exactly equal to the line’s own price (zeroes the line, not negative)', () => {
      const fullyDiscounted = { ...base, items: [{ ...validItem, quantity: 1, unitPrice: 50, lineDiscount: 50 }] }
      expect(invoicePayloadSchema.safeParse(fullyDiscounted).success).toBe(true)
    })
  })
})

describe('paymentPayloadSchema', () => {
  it('rejects a zero or negative payment amount', () => {
    expect(paymentPayloadSchema.safeParse({ amount: 0, method: 'CASH' }).success).toBe(false)
    expect(paymentPayloadSchema.safeParse({ amount: -10, method: 'CASH' }).success).toBe(false)
  })

  it('rejects NA as a payment method (placeholder-only, not a real method)', () => {
    expect(paymentPayloadSchema.safeParse({ amount: 10, method: 'NA' }).success).toBe(false)
  })

  it('accepts a valid payment', () => {
    expect(paymentPayloadSchema.safeParse({ amount: 100, method: 'STRIPE' }).success).toBe(true)
  })
})
