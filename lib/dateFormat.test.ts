import { describe, it, expect } from 'vitest'
import {
  formatDateTimeForViewer,
  formatDateForViewer,
  formatTimeForViewer,
  dayInTimeZone,
  monthInTimeZone,
  PEPSCORE_BUSINESS_TIMEZONE,
} from './dateFormat'

// The exact owner-observed defect (2026-09-04 timezone sprint): an event
// stamped 2026-09-04T00:11:00Z physically happened at 8:11 PM Eastern on
// September 3rd, but was displayed as "September 4, 12:11 AM" -- a raw UTC
// render leaking through. This is the literal regression test named in the
// spec.
const OBSERVED_DEFECT_INSTANT = '2026-09-04T00:11:00Z'

describe('exact regression: the observed 12:11 AM UTC defect', () => {
  it('America/New_York shows September 3, 8:11 PM (EDT)', () => {
    const result = formatDateTimeForViewer(OBSERVED_DEFECT_INSTANT, 'America/New_York')
    expect(result).toContain('Sep 3, 2026')
    expect(result).toContain('8:11 PM')
    expect(result).toContain('EDT')
    expect(result).not.toContain('Sep 4')
  })

  it('America/Los_Angeles shows September 3, 5:11 PM (PDT)', () => {
    const result = formatDateTimeForViewer(OBSERVED_DEFECT_INSTANT, 'America/Los_Angeles')
    expect(result).toContain('Sep 3, 2026')
    expect(result).toContain('5:11 PM')
    expect(result).toContain('PDT')
    expect(result).not.toContain('Sep 4')
  })

  it('the canonical UTC instant itself is unchanged and still reads September 4 -- this is expected for the raw storage value, never displayed directly to a human', () => {
    expect(new Date(OBSERVED_DEFECT_INSTANT).toISOString()).toBe('2026-09-04T00:11:00.000Z')
  })

  it('the business-timezone default (no explicit timeZone passed) matches the America/New_York result -- this is what every server-rendered surface without a known viewer timezone falls back to', () => {
    expect(PEPSCORE_BUSINESS_TIMEZONE).toBe('America/New_York')
    expect(formatDateTimeForViewer(OBSERVED_DEFECT_INSTANT)).toBe(formatDateTimeForViewer(OBSERVED_DEFECT_INSTANT, 'America/New_York'))
  })

  it('formatDateForViewer (date only) also lands on September 3 for both timezones, never September 4', () => {
    expect(formatDateForViewer(OBSERVED_DEFECT_INSTANT, 'America/New_York')).toBe('Sep 3, 2026')
    expect(formatDateForViewer(OBSERVED_DEFECT_INSTANT, 'America/Los_Angeles')).toBe('Sep 3, 2026')
  })

  it('formatTimeForViewer matches the time-only portion for both timezones', () => {
    expect(formatTimeForViewer(OBSERVED_DEFECT_INSTANT, 'America/New_York')).toContain('8:11 PM')
    expect(formatTimeForViewer(OBSERVED_DEFECT_INSTANT, 'America/Los_Angeles')).toContain('5:11 PM')
  })
})

describe('DST resolution -- standards-based, never a manually calculated offset', () => {
  it('America/New_York resolves EST in winter (no DST)', () => {
    expect(formatDateTimeForViewer('2026-01-15T17:00:00Z', 'America/New_York')).toContain('EST')
  })

  it('America/New_York resolves EDT in summer (DST active)', () => {
    expect(formatDateTimeForViewer('2026-07-15T17:00:00Z', 'America/New_York')).toContain('EDT')
  })

  it('America/Los_Angeles resolves PST in winter', () => {
    expect(formatDateTimeForViewer('2026-01-15T17:00:00Z', 'America/Los_Angeles')).toContain('PST')
  })

  it('America/Los_Angeles resolves PDT in summer', () => {
    expect(formatDateTimeForViewer('2026-07-15T17:00:00Z', 'America/Los_Angeles')).toContain('PDT')
  })
})

describe('date-boundary crossing', () => {
  it('same-local-day: a UTC instant that does not cross midnight in New York', () => {
    // 2026-09-03T15:00:00Z = 11:00 AM EDT, same calendar day both sides
    expect(formatDateForViewer('2026-09-03T15:00:00Z', 'America/New_York')).toBe('Sep 3, 2026')
  })

  it('previous-local-day: a UTC instant just after UTC midnight is still "yesterday" in New York and Los Angeles', () => {
    // 2026-09-03T02:00:00Z = 10:00 PM EDT Sep 2 / 7:00 PM PDT Sep 2
    expect(formatDateForViewer('2026-09-03T02:00:00Z', 'America/New_York')).toBe('Sep 2, 2026')
    expect(formatDateForViewer('2026-09-03T02:00:00Z', 'America/Los_Angeles')).toBe('Sep 2, 2026')
  })

  it('month boundary: a UTC instant just after UTC midnight on the 1st is still the last day of the prior month locally', () => {
    // 2026-10-01T02:00:00Z = 10:00 PM EDT Sep 30
    expect(formatDateForViewer('2026-10-01T02:00:00Z', 'America/New_York')).toBe('Sep 30, 2026')
    expect(monthInTimeZone(new Date('2026-10-01T02:00:00Z'), 'America/New_York')).toBe(9)
  })

  it('year boundary: a UTC instant just after UTC midnight on Jan 1 is still Dec 31 locally', () => {
    // 2027-01-01T03:00:00Z = 10:00 PM EST Dec 31, 2026
    expect(formatDateForViewer('2027-01-01T03:00:00Z', 'America/New_York')).toBe('Dec 31, 2026')
  })

  it('dayInTimeZone matches the same-instant date-boundary crossing', () => {
    expect(dayInTimeZone(new Date('2026-09-03T02:00:00Z'), 'America/New_York')).toBe(2)
    expect(dayInTimeZone(new Date('2026-09-03T15:00:00Z'), 'America/New_York')).toBe(3)
  })
})
