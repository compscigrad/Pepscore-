import { describe, it, expect } from 'vitest'
import { ProviderRouter } from './router'
import { MockAiProvider } from './mockProvider'
import { AiProviderError } from './types'

const req = { messages: [{ role: 'user' as const, content: 'hi' }] }

describe('ProviderRouter', () => {
  it('uses the primary provider when it succeeds', async () => {
    const primary = new MockAiProvider({ name: 'primary', completionText: 'from primary' })
    const router = new ProviderRouter(primary, null)

    const result = await router.complete(req)

    expect(result.text).toBe('from primary')
    expect(result.provider).toBe('primary')
    expect(result.usedFallback).toBe(false)
  })

  it('falls back when the primary fails and a fallback is configured', async () => {
    const primary = new MockAiProvider({ name: 'primary', shouldFailCompletion: true })
    const fallback = new MockAiProvider({ name: 'fallback', completionText: 'from fallback' })
    const router = new ProviderRouter(primary, fallback)

    const result = await router.complete(req)

    expect(result.text).toBe('from fallback')
    expect(result.provider).toBe('fallback')
    expect(result.usedFallback).toBe(true)
  })

  it('throws AiProviderError when the primary fails and there is no fallback', async () => {
    const primary = new MockAiProvider({ shouldFailCompletion: true })
    const router = new ProviderRouter(primary, null)

    await expect(router.complete(req)).rejects.toThrow(AiProviderError)
  })

  it('throws AiProviderError when both primary and fallback fail (safe failure, not a silent skip)', async () => {
    const primary = new MockAiProvider({ shouldFailCompletion: true })
    const fallback = new MockAiProvider({ shouldFailCompletion: true })
    const router = new ProviderRouter(primary, fallback)

    await expect(router.complete(req)).rejects.toThrow(AiProviderError)
  })

  it('folds both providers\' own error messages into the thrown error -- diagnosing a real failure (AI-1.16) requires more than a generic "both failed" string', async () => {
    const primary = new MockAiProvider({ shouldFailCompletion: true })
    const fallback = new MockAiProvider({ shouldFailCompletion: true })
    const router = new ProviderRouter(primary, fallback)

    await expect(router.complete(req)).rejects.toThrow(/Primary:[\s\S]*Fallback:/)
  })
})
