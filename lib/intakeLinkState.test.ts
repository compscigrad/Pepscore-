import { describe, it, expect } from 'vitest'
import { getIntakeLinkState } from './intakeLinkState'

const future = new Date(Date.now() + 60 * 60 * 1000)
const past = new Date(Date.now() - 60 * 60 * 1000)

function link(overrides: Partial<{
  expiresAt: Date
  viewedAt: Date | null
  invalidatedAt: Date | null
  submittedAt: Date | null
  submissionAttempts: number
}> = {}) {
  return {
    expiresAt: future,
    viewedAt: null,
    invalidatedAt: null,
    submittedAt: null,
    submissionAttempts: 0,
    ...overrides,
  }
}

describe('getIntakeLinkState', () => {
  it('is ACTIVE for a fresh, unused link', () => {
    expect(getIntakeLinkState(link())).toBe('ACTIVE')
  })

  it('is VIEWED once opened but not submitted', () => {
    expect(getIntakeLinkState(link({ viewedAt: new Date() }))).toBe('VIEWED')
  })

  it('is SUBMITTED once a submission has landed', () => {
    expect(getIntakeLinkState(link({ viewedAt: new Date(), submittedAt: new Date() }))).toBe('SUBMITTED')
  })

  it('is EXPIRED once past expiresAt, even if previously viewed', () => {
    expect(getIntakeLinkState(link({ expiresAt: past, viewedAt: new Date() }))).toBe('EXPIRED')
  })

  it('is INVALIDATED regardless of any other field, taking top priority', () => {
    expect(
      getIntakeLinkState(link({ invalidatedAt: new Date(), submittedAt: new Date(), expiresAt: past }))
    ).toBe('INVALIDATED')
  })

  it('is ATTEMPT_LIMIT_REACHED once submissionAttempts hits the cap', () => {
    expect(getIntakeLinkState(link({ submissionAttempts: 20 }))).toBe('ATTEMPT_LIMIT_REACHED')
  })

  it('prioritizes EXPIRED over ATTEMPT_LIMIT_REACHED when both are true', () => {
    expect(getIntakeLinkState(link({ expiresAt: past, submissionAttempts: 20 }))).toBe('EXPIRED')
  })
})
