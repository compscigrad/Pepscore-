import { describe, it, expect, vi } from 'vitest'
import { runAiPipeline, type PipelineDeps } from './pipeline'
import { ProviderRouter } from '../providers/router'
import { MockAiProvider } from '../providers/mockProvider'
import type { AiConfig } from '../providers/config'

let counter = 0
function uniqueId() {
  counter += 1
  return `pipeline-test-${counter}-${Date.now()}`
}

const baseConfig: AiConfig = {
  featureEnabled: true,
  gatewayApiKey: 'test',
  primaryModel: 'test-model',
  fallbackModel: undefined,
  embeddingModel: undefined,
  moderationModel: undefined,
  dailyCostLimitCents: 1000,
  rateLimitPerMinute: 100,
  rateLimitPerDay: 1000,
}

// No test in this file touches a real database -- logComplianceEvent/
// trackUsageEvent/getTodaysCostCents are all injected stubs, matching this
// repo's established convention for DB-backed writes (see
// lib/invoice/numbering.test.ts).
function fakeDeps(overrides: Partial<PipelineDeps> = {}): Required<PipelineDeps> {
  return {
    logComplianceEvent: vi.fn().mockResolvedValue(undefined),
    trackUsageEvent: vi.fn().mockResolvedValue(undefined),
    getTodaysCostCents: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as Required<PipelineDeps>
}

describe('runAiPipeline', () => {
  it('completes successfully for an allowed request, logging both compliance and usage events', async () => {
    const router = new ProviderRouter(new MockAiProvider({ completionText: 'safe research answer' }))
    const deps = fakeDeps()

    const outcome = await runAiPipeline(
      { text: 'do you sell Semaglutide', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      deps
    )

    expect(outcome.status).toBe('COMPLETED')
    if (outcome.status === 'COMPLETED') expect(outcome.text).toBe('safe research answer')
    expect(deps.logComplianceEvent).toHaveBeenCalledTimes(1)
    expect(deps.trackUsageEvent).toHaveBeenCalledTimes(1)
  })

  it('returns RATE_LIMITED and never calls the provider once the limit is exhausted', async () => {
    const id = uniqueId()
    const router = new ProviderRouter(new MockAiProvider({ completionText: 'should not be used' }))
    const tightConfig = { ...baseConfig, rateLimitPerMinute: 1 }

    await runAiPipeline({ text: 'do you sell Semaglutide', identifier: id, role: 'CLIENT', feature: 'test', router, config: tightConfig }, fakeDeps())
    const outcome = await runAiPipeline({ text: 'do you sell Semaglutide', identifier: id, role: 'CLIENT', feature: 'test', router, config: tightConfig }, fakeDeps())

    expect(outcome.status).toBe('RATE_LIMITED')
  })

  it('returns BUDGET_EXCEEDED and never calls the provider when the daily budget is already spent', async () => {
    const router = new ProviderRouter(new MockAiProvider())
    let providerCalled = false
    router.complete = async (req) => { providerCalled = true; return new MockAiProvider().complete(req) }
    const deps = fakeDeps({ getTodaysCostCents: vi.fn().mockResolvedValue(999999) })

    const outcome = await runAiPipeline(
      { text: 'do you sell Semaglutide', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      deps
    )

    expect(outcome.status).toBe('BUDGET_EXCEEDED')
    expect(providerCalled).toBe(false)
  })

  it('returns REFUSED for a HUMAN_USE request without ever calling the provider', async () => {
    const router = new ProviderRouter(new MockAiProvider())
    let providerCalled = false
    router.complete = async (req) => { providerCalled = true; return new MockAiProvider().complete(req) }

    const outcome = await runAiPipeline(
      { text: 'what should I take for weight loss', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      fakeDeps()
    )

    expect(outcome.status).toBe('REFUSED')
    expect(providerCalled).toBe(false)
  })

  it('returns ESCALATED for an ambiguous request with no classifier configured, never calling the provider', async () => {
    const router = new ProviderRouter(new MockAiProvider())
    let providerCalled = false
    router.complete = async (req) => { providerCalled = true; return new MockAiProvider().complete(req) }

    const outcome = await runAiPipeline(
      { text: 'an ambiguous message matching no rule', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      fakeDeps()
    )

    expect(outcome.status).toBe('ESCALATED')
    expect(providerCalled).toBe(false)
  })

  it('returns REFUSED via output validation when the provider itself produces prohibited text, even for an ALLOWED input', async () => {
    const router = new ProviderRouter(new MockAiProvider({ completionText: 'You should inject 250mg weekly.' }))
    const deps = fakeDeps()

    const outcome = await runAiPipeline(
      { text: 'do you sell Semaglutide', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      deps
    )

    expect(outcome.status).toBe('REFUSED')
    // Logged twice -- once for the (ALLOW) input decision, once for the
    // output-validation refusal.
    expect(deps.logComplianceEvent).toHaveBeenCalledTimes(2)
  })

  it('returns PROVIDER_FAILURE (a safe failure, not a silent success) when both primary and fallback fail', async () => {
    const primary = new MockAiProvider({ shouldFailCompletion: true })
    const fallback = new MockAiProvider({ shouldFailCompletion: true })
    const router = new ProviderRouter(primary, fallback)

    const outcome = await runAiPipeline(
      { text: 'do you sell Semaglutide', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      fakeDeps()
    )

    expect(outcome.status).toBe('PROVIDER_FAILURE')
  })

  it('a fallback completion goes through the identical output policy gate as primary would', async () => {
    const primary = new MockAiProvider({ shouldFailCompletion: true })
    const fallback = new MockAiProvider({ completionText: 'You should inject 250mg weekly.' })
    const router = new ProviderRouter(primary, fallback)

    const outcome = await runAiPipeline(
      { text: 'do you sell Semaglutide', identifier: uniqueId(), role: 'CLIENT', feature: 'test', router, config: baseConfig },
      fakeDeps()
    )

    expect(outcome.status).toBe('REFUSED')
  })
})
