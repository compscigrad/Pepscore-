import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadAiConfig } from './config'

const AI_ENV_KEYS = [
  'AI_FEATURE_ENABLED',
  'AI_GATEWAY_API_KEY',
  'AI_PRIMARY_MODEL',
  'AI_FALLBACK_MODEL',
  'AI_EMBEDDING_MODEL',
  'AI_MODERATION_MODEL',
  'AI_DAILY_COST_LIMIT_CENTS',
  'AI_RATE_LIMIT_PER_MINUTE',
  'AI_RATE_LIMIT_PER_DAY',
]

const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of AI_ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

describe('loadAiConfig', () => {
  it('defaults featureEnabled to false when AI_FEATURE_ENABLED is unset', () => {
    expect(loadAiConfig().featureEnabled).toBe(false)
  })

  it('defaults featureEnabled to false for any value other than the exact string "true"', () => {
    process.env.AI_FEATURE_ENABLED = 'yes'
    expect(loadAiConfig().featureEnabled).toBe(false)
    process.env.AI_FEATURE_ENABLED = '1'
    expect(loadAiConfig().featureEnabled).toBe(false)
  })

  it('only enables the feature flag on the exact string "true"', () => {
    process.env.AI_FEATURE_ENABLED = 'true'
    expect(loadAiConfig().featureEnabled).toBe(true)
  })

  it('defaults primaryModel/fallbackModel to the AI-1.12 registered, ZDR-approved routes when unset', () => {
    const config = loadAiConfig()
    expect(config.primaryModel).toBe('anthropic/claude-haiku-4.5')
    expect(config.fallbackModel).toBe('google/gemini-3.1-flash-lite')
  })

  it('respects an explicit env override for primaryModel/fallbackModel', () => {
    process.env.AI_PRIMARY_MODEL = 'openai/gpt-5-mini'
    process.env.AI_FALLBACK_MODEL = 'xai/grok-4.6'
    const config = loadAiConfig()
    expect(config.primaryModel).toBe('openai/gpt-5-mini')
    expect(config.fallbackModel).toBe('xai/grok-4.6')
  })

  it('applies conservative development defaults for cost/rate limits when unset', () => {
    const config = loadAiConfig()
    expect(config.dailyCostLimitCents).toBe(100)
    expect(config.rateLimitPerMinute).toBe(5)
    expect(config.rateLimitPerDay).toBe(50)
  })

  it('respects explicit env overrides for cost/rate limits', () => {
    process.env.AI_DAILY_COST_LIMIT_CENTS = '5000'
    process.env.AI_RATE_LIMIT_PER_MINUTE = '20'
    process.env.AI_RATE_LIMIT_PER_DAY = '500'
    const config = loadAiConfig()
    expect(config.dailyCostLimitCents).toBe(5000)
    expect(config.rateLimitPerMinute).toBe(20)
    expect(config.rateLimitPerDay).toBe(500)
  })

  it('never reads a NEXT_PUBLIC_-prefixed variable for any secret', () => {
    // Static assertion, not a runtime one -- reads this file's own source
    // to guard against a future edit accidentally introducing a
    // NEXT_PUBLIC_ secret. Belt-and-suspenders alongside code review.
    const src = fs.readFileSync(path.resolve(__dirname, 'config.ts'), 'utf8')
    expect(src).not.toMatch(/NEXT_PUBLIC_/)
  })
})
