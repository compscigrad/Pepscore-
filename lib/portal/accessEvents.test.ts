import { describe, it, expect, afterEach } from 'vitest'
import { getClerkEnvironment, mapClerkEventType, extractClerkUserId } from './accessEvents'

// processClerkWebhookEvent() and recordAccessEvent() are DB-backed (Prisma
// writes, the providerEventId idempotency guard, the clerkUserId ->
// Customer resolution) and are exercised against a real isolated Neon
// branch via rehearsal scripts, the same pattern used elsewhere in this
// codebase (see lib/invoice/numbering.test.ts) — this file covers the pure
// mapping/extraction logic only.

describe('getClerkEnvironment', () => {
  const original = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = original
  })

  it('reports development for a pk_test_ key', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc123'
    expect(getClerkEnvironment()).toBe('development')
  })

  it('reports production for a pk_live_ key', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123'
    expect(getClerkEnvironment()).toBe('production')
  })

  it('defaults to development (fail-safe, never silently claims production) when unset', () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    expect(getClerkEnvironment()).toBe('development')
  })
})

describe('mapClerkEventType', () => {
  it('maps every event type this app tracks', () => {
    expect(mapClerkEventType('user.created')).toBe('USER_CREATED')
    expect(mapClerkEventType('user.updated')).toBe('USER_UPDATED')
    expect(mapClerkEventType('user.deleted')).toBe('USER_DELETED')
    expect(mapClerkEventType('session.created')).toBe('SESSION_CREATED')
    expect(mapClerkEventType('session.ended')).toBe('SESSION_ENDED')
    expect(mapClerkEventType('session.removed')).toBe('SESSION_REMOVED')
    expect(mapClerkEventType('session.revoked')).toBe('SESSION_REVOKED')
    expect(mapClerkEventType('email.created')).toBe('EMAIL_CREATED')
  })

  it('returns null for event types this app does not use (Organizations, billing, etc)', () => {
    expect(mapClerkEventType('organization.created')).toBeNull()
    expect(mapClerkEventType('subscription.created')).toBeNull()
    expect(mapClerkEventType('some.unknown.future.event')).toBeNull()
  })
})

describe('extractClerkUserId', () => {
  it('reads user_id when present (session events)', () => {
    expect(extractClerkUserId({ user_id: 'user_abc', id: 'sess_xyz' })).toBe('user_abc')
  })

  it('falls back to id when user_id is absent (user events)', () => {
    expect(extractClerkUserId({ id: 'user_abc' })).toBe('user_abc')
  })

  it('returns null for a shape with neither field, without throwing', () => {
    expect(extractClerkUserId({ foo: 'bar' })).toBeNull()
  })

  it('returns null for non-object input, without throwing', () => {
    expect(extractClerkUserId(null)).toBeNull()
    expect(extractClerkUserId(undefined)).toBeNull()
    expect(extractClerkUserId('not an object')).toBeNull()
  })
})
