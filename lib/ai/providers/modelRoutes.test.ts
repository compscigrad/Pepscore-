import { describe, it, expect, beforeEach } from 'vitest'
import { MODEL_ROUTES, isRouteApproved } from './modelRoutes'

describe('modelRoutes', () => {
  beforeEach(() => {
    MODEL_ROUTES.length = 0
  })

  it('has no approved routes by default (no production model route has been verified yet)', () => {
    expect(MODEL_ROUTES).toEqual([])
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
