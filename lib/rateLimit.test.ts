import { describe, it, expect } from 'vitest'
import { checkRateLimit } from './rateLimit'

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true)
    }
  })

  it('blocks the request once the limit is reached', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000)
    }
    const result = checkRateLimit(key, 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks separate keys independently', () => {
    const keyA = `test-a-${Math.random()}`
    const keyB = `test-b-${Math.random()}`
    checkRateLimit(keyA, 1, 60_000)
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true)
  })

  it('resets the window once it elapses', () => {
    const key = `test-${Math.random()}`
    checkRateLimit(key, 1, 10)
    expect(checkRateLimit(key, 1, 10).allowed).toBe(false)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, 1, 10).allowed).toBe(true)
        resolve()
      }, 20)
    })
  })
})
