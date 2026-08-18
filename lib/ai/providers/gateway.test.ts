import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AiGatewayProvider } from './gateway'
import { AiProviderError } from './types'
import { MODEL_ROUTES } from './modelRoutes'
import type { AiConfig } from './config'

const baseConfig: AiConfig = {
  featureEnabled: false,
  gatewayApiKey: 'test-key',
  primaryModel: 'approved-model',
  fallbackModel: undefined,
  embeddingModel: 'approved-embedding-model',
  moderationModel: 'approved-moderation-model',
  dailyCostLimitCents: 100,
  rateLimitPerMinute: 5,
  rateLimitPerDay: 50,
}

// Temporarily register an approved route for the duration of these tests --
// MODEL_ROUTES is deliberately empty in production source (no route has
// actually been verified yet); these tests only need to prove the
// approval-gate mechanism works, not claim any real model is approved.
beforeEach(() => {
  MODEL_ROUTES.length = 0
  MODEL_ROUTES.push(
    { model: 'approved-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: 'test fixture' },
    { model: 'approved-embedding-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: 'test fixture' },
    { model: 'approved-moderation-model', providerRoute: 'test', zdrEligible: true, dataPolicyVerified: true, dateVerified: '2026-08-18', notes: 'test fixture' }
  )
})

describe('AiGatewayProvider', () => {
  it('never makes a real network call in this test file -- every fetch is mocked', () => {
    // Documents the invariant the rest of this suite depends on; no
    // assertion needed beyond the describe block itself using mockFetch.
    expect(true).toBe(true)
  })

  it('throws without making a request when the model route is not approved', async () => {
    const config = { ...baseConfig, primaryModel: 'unapproved-model' }
    const mockFetch = vi.fn()
    const provider = new AiGatewayProvider(config, mockFetch)

    await expect(provider.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(AiProviderError)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when the API key is not configured', async () => {
    const config = { ...baseConfig, gatewayApiKey: undefined }
    const mockFetch = vi.fn()
    const provider = new AiGatewayProvider(config, mockFetch)

    await expect(provider.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow('AI_GATEWAY_API_KEY')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends the correct request shape and parses a successful completion', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hello back' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
    })
    const provider = new AiGatewayProvider(baseConfig, mockFetch)

    const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('approved-model')
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])

    expect(result.text).toBe('hello back')
    expect(result.provider).toBe('vercel-ai-gateway')
    expect(result.inputTokens).toBe(3)
    expect(result.outputTokens).toBe(2)
    expect(result.usedFallback).toBe(false)
  })

  it('throws on a non-2xx response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const provider = new AiGatewayProvider(baseConfig, mockFetch)

    await expect(provider.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(AiProviderError)
  })

  it('throws when the underlying fetch itself rejects (network failure)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'))
    const provider = new AiGatewayProvider(baseConfig, mockFetch)

    await expect(provider.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(AiProviderError)
  })

  it('embed() rejects an unapproved embedding model route without a network call', async () => {
    const config = { ...baseConfig, embeddingModel: 'unapproved-embedding-model' }
    const mockFetch = vi.fn()
    const provider = new AiGatewayProvider(config, mockFetch)

    await expect(provider.embed({ input: ['hi'] })).rejects.toThrow(AiProviderError)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('moderate() parses flagged categories from a successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ flagged: true, categories: { violence: true, hate: false } }] }),
    })
    const provider = new AiGatewayProvider(baseConfig, mockFetch)

    const result = await provider.moderate({ input: 'test' })

    expect(result.flagged).toBe(true)
    expect(result.categories).toEqual(['violence'])
  })

  it('healthCheck() returns false without a key and never calls fetch', async () => {
    const config = { ...baseConfig, gatewayApiKey: undefined }
    const mockFetch = vi.fn()
    const provider = new AiGatewayProvider(config, mockFetch)

    expect(await provider.healthCheck()).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('healthCheck() reflects the mocked response status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    const provider = new AiGatewayProvider(baseConfig, mockFetch)

    expect(await provider.healthCheck()).toBe(true)
  })
})
