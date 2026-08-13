import { describe, it, expect } from 'vitest'
import { classifyFirstOrderReminderStage, isClaimDueForFirstOrderReminder, FIRST_ORDER_REMINDER_SCHEDULE_MS } from './firstOrderReminderEligibility'

// Deliberately NOT example.com/example.org/etc -- those are recognized
// test-data domains (lib/customers/linkageBackfill.ts) and would trip
// EXCLUDED_TEST_DATA on every case here except the one that's supposed to.
const baseCustomer = { firstName: 'Jane', lastName: 'Doe', email: 'jane@real-research-lab.com', smsOptedOut: false }
const noConflicts = new Set<string>()

describe('classifyFirstOrderReminderStage', () => {
  it('excludes a claim that already converted to a purchase', () => {
    const claim = { customerId: 'c1', claimedAt: new Date(0), remindersSent: 0, redeemedAt: new Date() }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now: Date.now(), conflictCustomerIds: noConflicts })).toBe(
      'EXCLUDED_ALREADY_PURCHASED'
    )
  })

  it('is not yet due before the day-2 threshold', () => {
    const now = Date.now()
    const claim = { customerId: 'c1', claimedAt: new Date(now), remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts })).toBe('NOT_YET_DUE')
  })

  it('is due at exactly the day-2 threshold', () => {
    const claimedAt = new Date(0)
    const now = FIRST_ORDER_REMINDER_SCHEDULE_MS[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts })).toBe('DAY_2_DUE')
    expect(isClaimDueForFirstOrderReminder(claim, baseCustomer, { now, conflictCustomerIds: noConflicts })).toBe(true)
  })

  it('is due at the day-5 threshold after one reminder already sent', () => {
    const claimedAt = new Date(0)
    const now = FIRST_ORDER_REMINDER_SCHEDULE_MS[1]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 1, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts })).toBe('DAY_5_DUE')
  })

  it('stops after the max reminder count is reached', () => {
    const claim = { customerId: 'c1', claimedAt: new Date(0), remindersSent: 2, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now: Date.now(), conflictCustomerIds: noConflicts })).toBe(
      'MAX_REMINDERS_REACHED'
    )
  })

  it('excludes an identity-review-flagged customer', () => {
    const claimedAt = new Date(0)
    const now = FIRST_ORDER_REMINDER_SCHEDULE_MS[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: new Set(['c1']) })).toBe(
      'EXCLUDED_IDENTITY_CONFLICT'
    )
  })

  it('excludes test data', () => {
    const claimedAt = new Date(0)
    const now = FIRST_ORDER_REMINDER_SCHEDULE_MS[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    const testCustomer = { ...baseCustomer, email: 'jane@example.com', firstName: 'Test' }
    expect(classifyFirstOrderReminderStage(claim, testCustomer, { now, conflictCustomerIds: noConflicts })).toBe('EXCLUDED_TEST_DATA')
  })
})
