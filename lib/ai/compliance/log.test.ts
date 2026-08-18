import { describe, it, expect } from 'vitest'
import { repeatWindowCutoff } from './log'

describe('repeatWindowCutoff', () => {
  it('returns a Date exactly windowMs before the given "now"', () => {
    const now = 1_000_000_000
    const windowMs = 60_000
    expect(repeatWindowCutoff(windowMs, now).getTime()).toBe(now - windowMs)
  })

  it('defaults to a 1-hour window when unspecified', () => {
    const now = 1_000_000_000
    const result = repeatWindowCutoff(undefined, now)
    expect(now - result.getTime()).toBe(60 * 60 * 1000)
  })
})

// logComplianceEvent() itself is DB-backed (a count + create against
// prisma.aiComplianceEvent) and follows the exact same convention as every
// other audit-log write in this codebase -- see this file's sibling
// header comment and lib/invoice/numbering.test.ts for the established
// precedent on why that isn't independently re-tested against a live
// database in this fast unit suite.
