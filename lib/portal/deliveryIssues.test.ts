import { describe, it, expect } from 'vitest'
import { summarizeRepeatedFailures, type PortalDeliveryIssue } from './deliveryIssues'

function issue(overrides: Partial<PortalDeliveryIssue>): PortalDeliveryIssue {
  return { id: 'log-1', cron: 'ROLLOUT', occurredAt: new Date('2026-08-01'), failedCount: 0, failures: [], ...overrides }
}

describe('summarizeRepeatedFailures', () => {
  it('excludes a customer who only ever failed once', () => {
    const issues = [issue({ failures: [{ customerId: 'a', error: 'timeout' }] })]
    expect(summarizeRepeatedFailures(issues)).toEqual([])
  })

  it('surfaces a customer who failed across two or more separate runs', () => {
    const issues = [
      issue({ id: 'log-1', occurredAt: new Date('2026-08-01'), failures: [{ customerId: 'a', error: 'timeout' }] }),
      issue({ id: 'log-2', occurredAt: new Date('2026-08-02'), failures: [{ customerId: 'a', error: 'invalid email' }] }),
    ]
    const summary = summarizeRepeatedFailures(issues)
    expect(summary).toEqual([{ customerId: 'a', count: 2, lastError: 'invalid email' }])
  })

  it('counts multiple customers independently and sorts by count descending', () => {
    const issues = [
      issue({ id: 'log-1', occurredAt: new Date('2026-08-01'), failures: [{ customerId: 'a', error: 'e1' }, { customerId: 'b', error: 'e2' }] }),
      issue({ id: 'log-2', occurredAt: new Date('2026-08-02'), failures: [{ customerId: 'a', error: 'e3' }] }),
      issue({ id: 'log-3', occurredAt: new Date('2026-08-03'), failures: [{ customerId: 'a', error: 'e4' }, { customerId: 'b', error: 'e5' }] }),
    ]
    expect(summarizeRepeatedFailures(issues)).toEqual([
      { customerId: 'a', count: 3, lastError: 'e4' },
      { customerId: 'b', count: 2, lastError: 'e5' },
    ])
  })

  it('picks lastError by occurredAt, not array order -- correct even when the caller passes newest-first', () => {
    // getRecentPortalDeliveryIssues() orders newest-first; the oldest run
    // (least recent) appears LAST in that array, so naive last-write-wins
    // over array order would pick the wrong (oldest) error.
    const issues = [
      issue({ id: 'log-newest', occurredAt: new Date('2026-08-03'), failures: [{ customerId: 'a', error: 'newest error' }] }),
      issue({ id: 'log-oldest', occurredAt: new Date('2026-08-01'), failures: [{ customerId: 'a', error: 'oldest error' }] }),
    ]
    expect(summarizeRepeatedFailures(issues)).toEqual([{ customerId: 'a', count: 2, lastError: 'newest error' }])
  })

  it('no issues produces an empty summary, not an error', () => {
    expect(summarizeRepeatedFailures([])).toEqual([])
  })
})
