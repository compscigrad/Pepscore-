// Basic in-memory rate limiting for the app's few public/unauthenticated
// routes (checkout, both webhooks, the admin ZIP-lookup proxy). Vercel's
// default Fluid Compute reuses function instances across invocations rather
// than spinning up fresh ones per request, so an in-memory fixed window
// holds up reasonably well for a single-region app at today's traffic.
//
// This is NOT distributed across regions/instances and resets on a cold
// start — it caps abuse and runaway loops, it doesn't guarantee an exact
// global limit. If traffic grows enough for that gap to matter, swap the
// bucket storage for a Redis-backed limiter (e.g. @upstash/ratelimit)
// without changing any call site's shape — checkRateLimit()'s signature
// stays the same either way.
import type { NextRequest } from 'next/server'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true }
}

// Best-effort client identifier — Vercel sets x-forwarded-for; falls back to
// a constant bucket (still caps total request rate) if it's ever absent.
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}
