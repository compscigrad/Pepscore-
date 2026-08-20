import { describe, it, expect } from 'vitest'
import { POLICIES, getPolicy, getPoliciesByCategory, searchPolicies, CATEGORY_LABEL } from './data'
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_RATE } from '@/lib/storefront/shipping'
import { STANDARD_VOLUME_TIERS } from '@/lib/pricing/canonicalPricing'

describe('Policy & Operations Center data integrity', () => {
  it('every policy has a unique id', () => {
    const ids = POLICIES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every policy has a real category with a known label', () => {
    for (const p of POLICIES) {
      expect(CATEGORY_LABEL[p.category]).toBeTruthy()
    }
  })

  it('getPolicy resolves an existing id and returns undefined for an unknown one', () => {
    expect(getPolicy('storefront-shipping-rate')?.name).toBe('Storefront Shipping Rate')
    expect(getPolicy('does-not-exist')).toBeUndefined()
  })

  it('getPoliciesByCategory only returns policies from that category', () => {
    const results = getPoliciesByCategory('SAMPLES_EVALUATION')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((p) => p.category === 'SAMPLES_EVALUATION')).toBe(true)
  })

  it('searchPolicies matches by name, rule text, and category label (case-insensitive)', () => {
    expect(searchPolicies('shipping').some((p) => p.id === 'storefront-shipping-rate')).toBe(true)
    expect(searchPolicies('BARTER').some((p) => p.id === 'evaluation-no-barter')).toBe(true)
    expect(searchPolicies('nonexistent-term-xyz')).toEqual([])
  })

  it('a system-enforced policy always cites a real source reference, never left blank', () => {
    for (const p of POLICIES.filter((p) => p.enforcement === 'SYSTEM_ENFORCED')) {
      expect(p.sourceRef.length).toBeGreaterThan(0)
    }
  })
})

// Drift protection: these policies' displayed numbers are generated from
// the real canonical constants, not hand-typed -- these tests fail loudly
// if a future edit to data.ts ever hardcodes a number instead of deriving
// it, since the assertion itself re-derives the expected text from the
// same live source the policy claims to describe.
describe('Policy drift protection -- numeric claims match live configuration', () => {
  it('the shipping policy text reflects the real threshold and rate', () => {
    const policy = getPolicy('storefront-shipping-rate')!
    expect(policy.currentRule).toContain(`$${FREE_SHIPPING_THRESHOLD}`)
    expect(policy.currentRule).toContain(`$${FLAT_SHIPPING_RATE.toFixed(2)}`)
  })

  it('the volume savings policy text reflects the real tier table', () => {
    const policy = getPolicy('standard-volume-case-savings')!
    for (const tier of STANDARD_VOLUME_TIERS) {
      const expectedRate = tier.rate === 0 ? 'standard price' : `${tier.rate * 100}%`
      expect(policy.currentRule).toContain(expectedRate)
    }
  })
})
