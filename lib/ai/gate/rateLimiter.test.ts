import { describe, it, expect } from 'vitest'
import { checkAiRateLimit } from './rateLimiter'

// Unique identifier per test -- lib/rateLimit.ts's bucket store is
// module-level shared state, same reason every existing caller of
// checkRateLimit() in this repo already namespaces its own keys.
let counter = 0
function uniqueId() {
  counter += 1
  return `test-${counter}-${Date.now()}`
}

describe('checkAiRateLimit', () => {
  it('allows the first request for a fresh identifier', () => {
    const result = checkAiRateLimit(uniqueId(), 'CLIENT', { perMinute: 5, perDay: 50 })
    expect(result.allowed).toBe(true)
  })

  it('denies once the per-minute limit is exhausted', () => {
    const id = uniqueId()
    for (let i = 0; i < 3; i++) checkAiRateLimit(id, 'CLIENT', { perMinute: 3, perDay: 50 })
    const result = checkAiRateLimit(id, 'CLIENT', { perMinute: 3, perDay: 50 })
    expect(result.allowed).toBe(false)
    expect(result.perMinute.allowed).toBe(false)
  })

  it('denies once the per-day limit is exhausted even if per-minute has room', () => {
    const id = uniqueId()
    for (let i = 0; i < 2; i++) checkAiRateLimit(id, 'CLIENT', { perMinute: 100, perDay: 2 })
    const result = checkAiRateLimit(id, 'CLIENT', { perMinute: 100, perDay: 2 })
    expect(result.allowed).toBe(false)
    expect(result.perDay.allowed).toBe(false)
  })

  it('scopes limits independently per role -- the same identifier under a different role is a fresh bucket', () => {
    const id = uniqueId()
    for (let i = 0; i < 3; i++) checkAiRateLimit(id, 'CLIENT', { perMinute: 3, perDay: 50 })
    const clientResult = checkAiRateLimit(id, 'CLIENT', { perMinute: 3, perDay: 50 })
    const adminResult = checkAiRateLimit(id, 'ADMIN', { perMinute: 3, perDay: 50 })
    expect(clientResult.allowed).toBe(false)
    expect(adminResult.allowed).toBe(true)
  })

  it('scopes limits independently per identifier under the same role', () => {
    const idA = uniqueId()
    const idB = uniqueId()
    for (let i = 0; i < 3; i++) checkAiRateLimit(idA, 'CLIENT', { perMinute: 3, perDay: 50 })
    expect(checkAiRateLimit(idA, 'CLIENT', { perMinute: 3, perDay: 50 }).allowed).toBe(false)
    expect(checkAiRateLimit(idB, 'CLIENT', { perMinute: 3, perDay: 50 }).allowed).toBe(true)
  })
})
