import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAdminClerkUser } from './isAdmin'

describe('isAdminClerkUser', () => {
  const original = process.env.ADMIN_CLERK_USER_ID

  beforeEach(() => {
    process.env.ADMIN_CLERK_USER_ID = 'user_admin_123'
  })
  afterEach(() => {
    process.env.ADMIN_CLERK_USER_ID = original
  })

  it('returns true only for the exact configured admin id', () => {
    expect(isAdminClerkUser('user_admin_123')).toBe(true)
  })

  it('returns false for any other user id', () => {
    expect(isAdminClerkUser('user_customer_456')).toBe(false)
  })

  it('returns false for null/undefined (unauthenticated)', () => {
    expect(isAdminClerkUser(null)).toBe(false)
    expect(isAdminClerkUser(undefined)).toBe(false)
  })

  it('fails closed when ADMIN_CLERK_USER_ID itself is unset', () => {
    delete process.env.ADMIN_CLERK_USER_ID
    expect(isAdminClerkUser('user_admin_123')).toBe(false)
    expect(isAdminClerkUser(null)).toBe(false)
  })
})
