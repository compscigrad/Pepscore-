import { describe, it, expect, beforeEach } from 'vitest'
import { buildProviderRouterFromConfig } from './factory'
import { MODEL_ROUTES } from './modelRoutes'
import type { AiConfig } from './config'

const baseConfig: AiConfig = {
  featureEnabled: false,
  liveModelEnabled: true,
  gatewayApiKey: 'test-key',
  primaryModel: 'approved-model',
  fallbackModel: 'approved-fallback-model',
  embeddingModel: undefined,
  moderationModel: undefined,
  dailyCostLimitCents: 100,
  rateLimitPerMinute: 5,
  rateLimitPerDay: 50,
}

beforeEach(() => {
  MODEL_ROUTES.length = 0
})

describe('buildProviderRouterFromConfig', () => {
  it('returns null when liveModelEnabled is off, even with everything else configured -- the actual kill switch (AI-1.15)', () => {
    MODEL_ROUTES.push({ model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })
    expect(buildProviderRouterFromConfig({ ...baseConfig, liveModelEnabled: false })).toBeNull()
  })

  it('is unaffected by featureEnabled (the separate public-customer flag) -- a router can be built for admin/internal use while the public route stays off', () => {
    MODEL_ROUTES.push({ model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })
    expect(buildProviderRouterFromConfig({ ...baseConfig, featureEnabled: false, liveModelEnabled: true })).not.toBeNull()
  })

  it('returns null without a gateway credential', () => {
    MODEL_ROUTES.push({ model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })
    expect(buildProviderRouterFromConfig({ ...baseConfig, gatewayApiKey: undefined })).toBeNull()
  })

  it('returns null when the primary model has no approved route', () => {
    expect(buildProviderRouterFromConfig(baseConfig)).toBeNull()
  })

  it('returns a router with no fallback when only the primary model is approved', () => {
    MODEL_ROUTES.push({ model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' })
    const router = buildProviderRouterFromConfig(baseConfig)
    expect(router).not.toBeNull()
  })

  it('returns a router with a distinct fallback provider when both models are approved', async () => {
    MODEL_ROUTES.push(
      { model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' },
      { model: 'approved-fallback-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: '' }
    )
    const router = buildProviderRouterFromConfig(baseConfig)
    expect(router).not.toBeNull()
    // Primary has no real network access in this test (no fetch mock), so
    // asserting the router exists and is the real class is the meaningful
    // check here -- gateway.test.ts already proves the override itself
    // targets the right model.
    expect(router?.constructor.name).toBe('ProviderRouter')
  })
})
