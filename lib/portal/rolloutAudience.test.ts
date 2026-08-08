// Permanent regression suite for the pure exclusion logic behind
// computeEligibleInviteAudience() -- the function that decides who is safe
// to include in the automated bulk-invitation rollout. The DB-touching
// full function (real Prisma queries, conflict-review/invite-state
// branching) was verified against the shared production database via a
// disposable rehearsal test at the time this was written, per this repo's
// convention of never running DB-mutating tests in the permanent suite.
import { describe, it, expect } from 'vitest'
import { classifyByContactInfo, findDuplicateContactCustomerIds, normalizeEmail, normalizePhone } from './rolloutAudience'

interface FakeCustomer {
  id: string
  email: string | null
  phone: string | null
}

function customer(overrides: Partial<FakeCustomer> & { id: string }): FakeCustomer {
  return { email: null, phone: null, ...overrides }
}

describe('normalizeEmail / normalizePhone', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com')
  })

  it('returns null for empty/whitespace-only/missing email', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
  })

  it('normalizes to the last 10 digits, dropping a leading country code', () => {
    expect(normalizePhone('+1 (305) 984-2899')).toBe('3059842899')
    expect(normalizePhone('(305) 984-2899')).toBe('3059842899')
  })

  it('returns null for empty/missing/too-short phone', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('4567')).toBeNull()
  })
})

describe('classifyByContactInfo', () => {
  it('sorts a customer with neither email nor phone into missingContact', () => {
    const c = customer({ id: 'c1' })
    const { missingContact, withContact } = classifyByContactInfo([c])
    expect(missingContact).toEqual([c])
    expect(withContact).toEqual([])
  })

  it('sorts a customer with only an email into withContact', () => {
    const c = customer({ id: 'c1', email: 'a@example.com' })
    const { missingContact, withContact } = classifyByContactInfo([c])
    expect(missingContact).toEqual([])
    expect(withContact).toEqual([c])
  })

  it('sorts a customer with only a phone into withContact', () => {
    const c = customer({ id: 'c1', phone: '5551234567' })
    const { missingContact, withContact } = classifyByContactInfo([c])
    expect(missingContact).toEqual([])
    expect(withContact).toEqual([c])
  })

  it('preserves order and handles a mixed batch', () => {
    const withEmail = customer({ id: 'c1', email: 'a@example.com' })
    const bare = customer({ id: 'c2' })
    const withPhone = customer({ id: 'c3', phone: '5551234567' })
    const { missingContact, withContact } = classifyByContactInfo([withEmail, bare, withPhone])
    expect(missingContact).toEqual([bare])
    expect(withContact).toEqual([withEmail, withPhone])
  })
})

describe('findDuplicateContactCustomerIds', () => {
  it('flags two customers sharing the same email (case/whitespace-insensitive)', () => {
    const a = customer({ id: 'a', email: 'Jane@Example.com' })
    const b = customer({ id: 'b', email: ' jane@example.com ' })
    const dupes = findDuplicateContactCustomerIds([a, b])
    expect(dupes).toEqual(new Set(['a', 'b']))
  })

  it('flags two customers sharing the same phone (formatting-insensitive)', () => {
    const a = customer({ id: 'a', phone: '(305) 984-2899' })
    const b = customer({ id: 'b', phone: '305-984-2899' })
    const dupes = findDuplicateContactCustomerIds([a, b])
    expect(dupes).toEqual(new Set(['a', 'b']))
  })

  it('flags a country-code-prefixed number as a duplicate of its bare equivalent -- same real number either way', () => {
    const a = customer({ id: 'a', phone: '(305) 984-2899' })
    const b = customer({ id: 'b', phone: '+1-305-984-2899' })
    expect(findDuplicateContactCustomerIds([a, b])).toEqual(new Set(['a', 'b']))
  })

  it('does not flag a too-short/garbage phone value as matching anything', () => {
    const a = customer({ id: 'a', phone: '123' })
    const b = customer({ id: 'b', phone: '456' })
    expect(findDuplicateContactCustomerIds([a, b])).toEqual(new Set())
  })

  it('does not flag two customers with genuinely different contact info', () => {
    const a = customer({ id: 'a', email: 'a@example.com', phone: '5551111111' })
    const b = customer({ id: 'b', email: 'b@example.com', phone: '5552222222' })
    expect(findDuplicateContactCustomerIds([a, b])).toEqual(new Set())
  })

  it('flags a three-way email collision, not just a pair', () => {
    const a = customer({ id: 'a', email: 'shared@example.com' })
    const b = customer({ id: 'b', email: 'shared@example.com' })
    const c = customer({ id: 'c', email: 'shared@example.com' })
    expect(findDuplicateContactCustomerIds([a, b, c])).toEqual(new Set(['a', 'b', 'c']))
  })

  it('flags a customer whose email matches one row and phone matches a different row', () => {
    const a = customer({ id: 'a', email: 'shared@example.com', phone: '5551111111' })
    const b = customer({ id: 'b', email: 'shared@example.com' })
    const c = customer({ id: 'c', phone: '5551111111' })
    const dupes = findDuplicateContactCustomerIds([a, b, c])
    expect(dupes).toEqual(new Set(['a', 'b', 'c']))
  })

  it('a single customer with unique contact info is never flagged', () => {
    const a = customer({ id: 'a', email: 'unique@example.com', phone: '5559999999' })
    expect(findDuplicateContactCustomerIds([a])).toEqual(new Set())
  })

  it('an empty batch produces no duplicates', () => {
    expect(findDuplicateContactCustomerIds([])).toEqual(new Set())
  })
})
