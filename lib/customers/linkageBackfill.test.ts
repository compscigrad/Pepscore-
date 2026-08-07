import { describe, it, expect } from 'vitest'
import { planLinkageBackfill, looksLikeTestData, splitName, normalizeEmail, normalizePhone, pickMostRecentAddress } from './linkageBackfill'
import type { OrphanInvoiceSnapshot, ExistingCustomerCandidate } from './linkageBackfill'

function invoice(overrides: Partial<OrphanInvoiceSnapshot>): OrphanInvoiceSnapshot {
  return {
    id: 'inv1',
    invoiceNumber: 'PS-0001',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.org',
    customerPhone: null,
    billingAddress: null,
    shippingAddress: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('splitName', () => {
  it('splits a two-word name into first/last', () => {
    expect(splitName('Marvin Alexander')).toEqual({ firstName: 'Marvin', lastName: 'Alexander' })
  })
  it('keeps a multi-word last name intact', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ firstName: 'Mary', lastName: 'Jane Watson' })
  })
  it('leaves lastName empty for a single-word name', () => {
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' })
  })
})

describe('looksLikeTestData', () => {
  it('flags a name containing "Test"', () => {
    expect(looksLikeTestData('QA Test Customer', 'qa-test@example.com')).toBe(true)
  })
  it('flags an example.com email even with an ordinary name', () => {
    expect(looksLikeTestData('Jane Doe', 'jane@example.com')).toBe(true)
  })
  it('does not flag a real-looking name and email', () => {
    expect(looksLikeTestData('Marvin Alexander', 'marvin@marvinalexanderbeauty.com')).toBe(false)
  })
})

describe('normalizeEmail / normalizePhone', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com')
  })
  it('returns null for empty/missing email', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail('')).toBeNull()
  })
  it('strips non-digits from phone', () => {
    expect(normalizePhone('+1 (305) 984-2899')).toBe('13059842899')
  })
})

describe('planLinkageBackfill', () => {
  it('groups multiple invoices for the same person (by email) into one safeCreateNew entry', () => {
    const invoices = [
      invoice({ id: 'a', invoiceNumber: 'PS-0001', customerName: 'Marvin Alexander', customerEmail: 'marvin@x.com' }),
      invoice({ id: 'b', invoiceNumber: 'PS-0020', customerName: 'Marvin Alexander', customerEmail: 'Marvin@X.com' }),
    ]
    const plan = planLinkageBackfill(invoices, [])
    expect(plan.safeCreateNew).toHaveLength(1)
    expect(plan.safeCreateNew[0].invoices.map((i) => i.invoiceNumber).sort()).toEqual(['PS-0001', 'PS-0020'])
    expect(plan.noContact).toHaveLength(0)
    expect(plan.ambiguous).toHaveLength(0)
  })

  it('routes an invoice with zero email/phone to noContact and never invents a match', () => {
    const invoices = [invoice({ customerEmail: null, customerPhone: null })]
    const plan = planLinkageBackfill(invoices, [])
    expect(plan.noContact).toHaveLength(1)
    expect(plan.safeCreateNew).toHaveLength(0)
  })

  it('links to the single existing Customer when exactly one matches by email', () => {
    const existing: ExistingCustomerCandidate[] = [{ id: 'cust1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.org', phone: null }]
    const plan = planLinkageBackfill([invoice({})], existing)
    expect(plan.safeLinkExisting).toHaveLength(1)
    expect(plan.safeLinkExisting[0].existingCandidates[0].id).toBe('cust1')
  })

  it('routes to ambiguous when more than one existing Customer matches (never guesses)', () => {
    const existing: ExistingCustomerCandidate[] = [
      { id: 'cust1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.org', phone: null },
      { id: 'cust2', firstName: 'Jane', lastName: 'D.', email: null, phone: '5551234567' },
    ]
    const plan = planLinkageBackfill([invoice({ customerPhone: '555-123-4567' })], existing)
    expect(plan.ambiguous).toHaveLength(1)
    expect(plan.safeLinkExisting).toHaveLength(0)
    expect(plan.safeCreateNew).toHaveLength(0)
  })

  it('excludes obvious test/QA data from safeCreateNew into its own testData bucket', () => {
    const plan = planLinkageBackfill(
      [invoice({ customerName: 'QA Test Customer', customerEmail: 'qa-test@example.com' })],
      []
    )
    expect(plan.testData).toHaveLength(1)
    expect(plan.safeCreateNew).toHaveLength(0)
  })

  it('is idempotent-safe: an empty orphan list produces an empty plan', () => {
    const plan = planLinkageBackfill([], [{ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.com', phone: null }])
    expect(plan.noContact).toHaveLength(0)
    expect(plan.testData).toHaveLength(0)
    expect(plan.safeCreateNew).toHaveLength(0)
    expect(plan.safeLinkExisting).toHaveLength(0)
    expect(plan.ambiguous).toHaveLength(0)
  })
})

describe('pickMostRecentAddress', () => {
  const addr1 = { street1: '650 S Spring Street', city: 'Los Angeles' }
  const addr2 = { street1: '650 South Spring Street', city: 'Los Angeles' }

  it('returns null addresses when no invoice in the group has one', () => {
    const result = pickMostRecentAddress([invoice({}), invoice({ id: 'inv2' })])
    expect(result).toEqual({ billingAddress: null, shippingAddress: null, sourceInvoiceNumber: null })
  })

  it('uses the single address when only one invoice has one', () => {
    const result = pickMostRecentAddress([invoice({ billingAddress: addr1, shippingAddress: addr1 })])
    expect(result.billingAddress).toEqual(addr1)
    expect(result.sourceInvoiceNumber).toBe('PS-0001')
  })

  it('picks the most-recently-created invoice address when addresses differ (this is Marvin Alexander\'s exact case)', () => {
    const older = invoice({ id: 'a', invoiceNumber: 'PS-2026-000001', billingAddress: addr1, shippingAddress: addr1, createdAt: new Date('2026-07-20') })
    const newer = invoice({ id: 'b', invoiceNumber: 'PS-2026-000020', billingAddress: addr2, shippingAddress: addr2, createdAt: new Date('2026-07-28') })
    const result = pickMostRecentAddress([older, newer])
    expect(result.billingAddress).toEqual(addr2)
    expect(result.sourceInvoiceNumber).toBe('PS-2026-000020')
  })

  it('ignores invoice order in the input array -- always sorts by createdAt', () => {
    const older = invoice({ id: 'a', invoiceNumber: 'OLD', billingAddress: addr1, createdAt: new Date('2026-01-01') })
    const newer = invoice({ id: 'b', invoiceNumber: 'NEW', billingAddress: addr2, createdAt: new Date('2026-06-01') })
    expect(pickMostRecentAddress([newer, older]).sourceInvoiceNumber).toBe('NEW')
    expect(pickMostRecentAddress([older, newer]).sourceInvoiceNumber).toBe('NEW')
  })

  it('skips invoices with no address when picking the most recent one that has one', () => {
    const withNoAddress = invoice({ id: 'a', invoiceNumber: 'NO-ADDR', createdAt: new Date('2026-06-01') })
    const withAddress = invoice({ id: 'b', invoiceNumber: 'HAS-ADDR', billingAddress: addr1, createdAt: new Date('2026-01-01') })
    const result = pickMostRecentAddress([withNoAddress, withAddress])
    expect(result.sourceInvoiceNumber).toBe('HAS-ADDR')
  })
})
