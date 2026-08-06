import { describe, it, expect } from 'vitest'
import { planLinkageBackfill, looksLikeTestData, splitName, normalizeEmail, normalizePhone } from './linkageBackfill'
import type { OrphanInvoiceSnapshot, ExistingCustomerCandidate } from './linkageBackfill'

function invoice(overrides: Partial<OrphanInvoiceSnapshot>): OrphanInvoiceSnapshot {
  return { id: 'inv1', invoiceNumber: 'PS-0001', customerName: 'Jane Doe', customerEmail: 'jane@example.org', customerPhone: null, ...overrides }
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
