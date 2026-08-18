// Separate file, not lib/customers.test.ts -- lib/customers.ts is
// otherwise DB-orchestration (customer search/lookup/dedup queries),
// matching this repo's established convention. jsonZipMatches is the one
// pure guard, used in duplicate-customer detection (a false negative here
// means a real duplicate customer goes unflagged; a false positive
// incorrectly flags two unrelated customers as a possible match).
import { describe, it, expect } from 'vitest'
import { jsonZipMatches } from './customers'

describe('jsonZipMatches', () => {
  it('matches when the stored address JSON has an equal zip field', () => {
    expect(jsonZipMatches({ zip: '90210', city: 'Beverly Hills' }, '90210')).toBe(true)
  })

  it('does not match a different zip', () => {
    expect(jsonZipMatches({ zip: '90210' }, '10001')).toBe(false)
  })

  it('returns false for null', () => {
    expect(jsonZipMatches(null, '90210')).toBe(false)
  })

  it('returns false for a non-object JSON value (defensive against malformed stored JSON)', () => {
    expect(jsonZipMatches('90210' as never, '90210')).toBe(false)
    expect(jsonZipMatches(90210 as never, '90210')).toBe(false)
  })

  it('returns false for a JSON array', () => {
    expect(jsonZipMatches(['90210'] as never, '90210')).toBe(false)
  })

  it('returns false when the address object has no zip field at all', () => {
    expect(jsonZipMatches({ city: 'Beverly Hills' }, '90210')).toBe(false)
  })
})
