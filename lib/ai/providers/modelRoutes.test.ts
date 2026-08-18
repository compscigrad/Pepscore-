import { describe, it, expect, beforeEach } from 'vitest'
import { MODEL_ROUTES, isRouteApproved } from './modelRoutes'

// Snapshot the real, shipped default content before any test's beforeEach
// clears the shared array -- this is the actual production state, not a
// test fixture.
const REAL_DEFAULT_ROUTES = [...MODEL_ROUTES]

describe('modelRoutes -- real shipped defaults (AI-1.12)', () => {
  it('registers exactly the two live-integration-phase routes, both approved', () => {
    expect(REAL_DEFAULT_ROUTES.map((r) => r.model)).toEqual(['anthropic/claude-haiku-4.5', 'google/gemini-3.1-flash-lite'])
    for (const route of REAL_DEFAULT_ROUTES) {
      expect(route.zdrEligible).toBe(true)
      expect(route.dataPolicyVerified).toBe(true)
      expect(route.dateVerified).not.toBeNull()
    }
  })

  it('primary and fallback are genuinely different underlying providers, not just different model IDs from the same vendor', () => {
    const providers = new Set(REAL_DEFAULT_ROUTES.map((r) => r.providerRoute))
    expect(providers.size).toBe(REAL_DEFAULT_ROUTES.length)
  })

  it('excludes the documented claude-fable-5 ZDR exception', () => {
    expect(REAL_DEFAULT_ROUTES.some((r) => r.model.includes('claude-fable'))).toBe(false)
  })
})

describe('isRouteApproved -- approval rules', () => {
  beforeEach(() => {
    MODEL_ROUTES.length = 0
  })

  it('returns false for a model with no registered route', () => {
    expect(isRouteApproved('anything')).toBe(false)
  })

  it('requires zdrEligible, dataPolicyVerified, and a real dateVerified to be approved', () => {
    MODEL_ROUTES.push({ model: 'm1', providerRoute: 'r', zdrEligible: false, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })
    MODEL_ROUTES.push({ model: 'm2', providerRoute: 'r', zdrEligible: true, dataPolicyVerified: false, dateVerified: '2026-08-18', notes: '' })
    MODEL_ROUTES.push({ model: 'm3', providerRoute: 'r', zdrEligible: true, dataPolicyVerified: true, dateVerified: null, notes: '' })
    MODEL_ROUTES.push({ model: 'm4', providerRoute: 'r', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })

    expect(isRouteApproved('m1')).toBe(false)
    expect(isRouteApproved('m2')).toBe(false)
    expect(isRouteApproved('m3')).toBe(false)
    expect(isRouteApproved('m4')).toBe(true)
  })
})
