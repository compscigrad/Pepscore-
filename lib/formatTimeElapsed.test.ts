import { describe, it, expect } from 'vitest'
import { formatTimeElapsed } from './formatTimeElapsed'

const now = new Date('2026-07-21T12:00:00.000Z')

describe('formatTimeElapsed', () => {
  it('returns "just now" for under a minute', () => {
    expect(formatTimeElapsed(new Date('2026-07-21T11:59:31.000Z'), now)).toBe('just now')
  })

  it('formats minutes, singular and plural', () => {
    expect(formatTimeElapsed(new Date('2026-07-21T11:59:00.000Z'), now)).toBe('1 minute')
    expect(formatTimeElapsed(new Date('2026-07-21T11:37:00.000Z'), now)).toBe('23 minutes')
  })

  it('formats hours, singular and plural', () => {
    expect(formatTimeElapsed(new Date('2026-07-21T11:00:00.000Z'), now)).toBe('1 hour')
    expect(formatTimeElapsed(new Date('2026-07-21T10:00:00.000Z'), now)).toBe('2 hours')
  })

  it('formats days, singular and plural', () => {
    expect(formatTimeElapsed(new Date('2026-07-20T12:00:00.000Z'), now)).toBe('1 day')
    expect(formatTimeElapsed(new Date('2026-07-18T12:00:00.000Z'), now)).toBe('3 days')
  })

  it('never goes negative for a timestamp in the future', () => {
    expect(formatTimeElapsed(new Date('2026-07-21T12:05:00.000Z'), now)).toBe('just now')
  })
})
