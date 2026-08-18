import { describe, it, expect } from 'vitest'
import { buildConfigStatus, aggregateUsage, aggregateCompliance } from './adminSummary'

describe('buildConfigStatus', () => {
  it('reports the feature flag off and no configured provider secrets by default -- matches the dark-by-default env, no keys set in this test run', () => {
    const status = buildConfigStatus()
    expect(status.featureEnabled).toBe(false)
    expect(status.gatewayConfigured).toBe(false)
    expect(status.approvedModelRouteCount).toBe(0)
    expect(status.totalModelRouteCount).toBe(0)
  })

  it('never exposes the raw config values themselves -- only booleans/counts', () => {
    const status = buildConfigStatus()
    expect(status).not.toHaveProperty('gatewayApiKey')
    expect(status).not.toHaveProperty('primaryModel')
  })
})

describe('aggregateUsage', () => {
  it('returns zeroed totals for no events -- never fabricates spend', () => {
    const summary = aggregateUsage([])
    expect(summary.totalCalls).toBe(0)
    expect(summary.totalCostCents).toBe(0)
    expect(summary.byModel).toEqual([])
  })

  it('splits success/failure/fallback counts and sums cost', () => {
    const summary = aggregateUsage([
      { provider: 'vercel', model: 'a', success: true, usedFallback: false, estimatedCostCents: 10 },
      { provider: 'vercel', model: 'a', success: false, usedFallback: true, estimatedCostCents: 5 },
      { provider: 'vercel', model: 'b', success: true, usedFallback: false, estimatedCostCents: 20 },
    ])
    expect(summary.totalCalls).toBe(3)
    expect(summary.successCount).toBe(2)
    expect(summary.failureCount).toBe(1)
    expect(summary.fallbackCount).toBe(1)
    expect(summary.totalCostCents).toBe(35)
  })

  it('groups per-model totals and sorts by call count descending', () => {
    const summary = aggregateUsage([
      { provider: 'vercel', model: 'a', success: true, usedFallback: false, estimatedCostCents: 1 },
      { provider: 'vercel', model: 'b', success: true, usedFallback: false, estimatedCostCents: 1 },
      { provider: 'vercel', model: 'b', success: true, usedFallback: false, estimatedCostCents: 1 },
    ])
    expect(summary.byModel[0]).toMatchObject({ model: 'b', calls: 2, costCents: 2 })
    expect(summary.byModel[1]).toMatchObject({ model: 'a', calls: 1, costCents: 1 })
  })
})

describe('aggregateCompliance', () => {
  it('returns zeroed totals for no events', () => {
    const summary = aggregateCompliance([])
    expect(summary.totalEvents).toBe(0)
    expect(summary.byCategory).toEqual([])
    expect(summary.unreviewedEscalations).toBe(0)
  })

  it('counts unreviewed escalations separately from reviewed ones', () => {
    const summary = aggregateCompliance([
      { policyCategory: 'HUMAN_USE', policyAction: 'ESCALATE', reviewStatus: 'UNREVIEWED' },
      { policyCategory: 'HUMAN_USE', policyAction: 'ESCALATE', reviewStatus: 'REVIEWED' },
      { policyCategory: 'JAILBREAK', policyAction: 'REFUSE', reviewStatus: 'UNREVIEWED' },
    ])
    expect(summary.unreviewedEscalations).toBe(1)
    expect(summary.totalEvents).toBe(3)
  })

  it('groups by category and action, sorted by count descending', () => {
    const summary = aggregateCompliance([
      { policyCategory: 'CATALOG', policyAction: 'ALLOW', reviewStatus: 'UNREVIEWED' },
      { policyCategory: 'CATALOG', policyAction: 'ALLOW', reviewStatus: 'UNREVIEWED' },
      { policyCategory: 'HUMAN_USE', policyAction: 'REFUSE', reviewStatus: 'UNREVIEWED' },
    ])
    expect(summary.byCategory[0]).toMatchObject({ category: 'CATALOG', count: 2 })
    expect(summary.byAction[0]).toMatchObject({ action: 'ALLOW', count: 2 })
  })
})
