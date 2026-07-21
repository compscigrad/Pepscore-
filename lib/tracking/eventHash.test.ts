import { describe, it, expect } from 'vitest'
import { computeEventHash } from './eventHash'
import type { NormalizedTrackingEvent } from './types'

const baseEvent: NormalizedTrackingEvent = {
  normalizedStatus: 'IN_TRANSIT',
  carrierStatus: 'In transit',
  description: 'In transit',
  eventAt: new Date('2026-07-20T12:00:00Z'),
}

describe('computeEventHash', () => {
  it('uses the provider event id directly when available', () => {
    expect(computeEventHash({ ...baseEvent, providerEventId: 'abc123' })).toBe('abc123')
  })

  it('produces the same hash for identical events without a provider id (dedup)', () => {
    const a = computeEventHash({ ...baseEvent })
    const b = computeEventHash({ ...baseEvent })
    expect(a).toBe(b)
  })

  it('produces a different hash when the status differs', () => {
    const a = computeEventHash({ ...baseEvent, normalizedStatus: 'IN_TRANSIT' })
    const b = computeEventHash({ ...baseEvent, normalizedStatus: 'DELAYED' })
    expect(a).not.toBe(b)
  })

  it('produces a different hash when the event time differs (out-of-order events stay distinguishable)', () => {
    const a = computeEventHash({ ...baseEvent, eventAt: new Date('2026-07-20T12:00:00Z') })
    const b = computeEventHash({ ...baseEvent, eventAt: new Date('2026-07-21T12:00:00Z') })
    expect(a).not.toBe(b)
  })
})
