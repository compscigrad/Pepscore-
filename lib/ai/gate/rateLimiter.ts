// AI-0B.5 -- thin wrapper over the EXISTING in-memory rate limiter
// (lib/rateLimit.ts), reused as-is per owner instruction ("Reuse
// lib/rateLimit.ts during AI-0B foundation/testing where appropriate").
//
// Classification (owner instruction, item 7):
//   AI-0B: this in-memory limiter is acceptable for isolated foundation/
//     testing traffic -- no customer-facing AI surface exists yet.
//   AI-1 PUBLIC: a distributed/shared limiter (the same @upstash/ratelimit
//     upgrade path lib/rateLimit.ts's own header already anticipates) MUST
//     be evaluated before any public AI traffic exists, since AI requests
//     may execute across multiple serverless instances. checkAiRateLimit()
//     is deliberately the only thing AI business logic depends on, so
//     swapping the underlying implementation later requires no caller
//     changes.
import { checkRateLimit, type RateLimitResult } from '@/lib/rateLimit'
import type { AiRole } from '../permissions/roles'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60_000

export interface AiRateLimits {
  perMinute: number
  perDay: number
}

export interface AiRateLimitCheck {
  perMinute: RateLimitResult
  perDay: RateLimitResult
  allowed: boolean
}

export function checkAiRateLimit(identifier: string, role: AiRole, limits: AiRateLimits): AiRateLimitCheck {
  const key = `ai:${role}:${identifier}`
  const perMinute = checkRateLimit(`${key}:minute`, limits.perMinute, MINUTE_MS)
  const perDay = checkRateLimit(`${key}:day`, limits.perDay, DAY_MS)
  return { perMinute, perDay, allowed: perMinute.allowed && perDay.allowed }
}
