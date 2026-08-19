import { describe, it, expect } from 'vitest'
import {
  classifyFirstOrderReminderStage,
  isClaimDueForFirstOrderReminder,
  hoursToScheduleMs,
  DEFAULT_FIRST_ORDER_REMINDER_SCHEDULE_HOURS,
} from './firstOrderReminderEligibility'

// Deliberately NOT example.com/example.org/etc -- those are recognized
// test-data domains (lib/customers/linkageBackfill.ts) and would trip
// EXCLUDED_TEST_DATA on every case here except the one that's supposed to.
const baseCustomer = { firstName: 'Jane', lastName: 'Doe', email: 'jane@real-research-lab.com', smsOptedOut: false }
const noConflicts = new Set<string>()
const scheduleMs = hoursToScheduleMs(DEFAULT_FIRST_ORDER_REMINDER_SCHEDULE_HOURS) // [24h, 72h, 168h]

describe('classifyFirstOrderReminderStage', () => {
  it('excludes a claim that already converted to a purchase', () => {
    const claim = { customerId: 'c1', claimedAt: new Date(0), remindersSent: 0, redeemedAt: new Date() }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now: Date.now(), conflictCustomerIds: noConflicts, scheduleMs })).toBe(
      'EXCLUDED_ALREADY_PURCHASED'
    )
  })

  it('is not yet due before the first threshold', () => {
    const now = Date.now()
    const claim = { customerId: 'c1', claimedAt: new Date(now), remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe('NOT_YET_DUE')
  })

  it('is due at exactly the first (24h) threshold', () => {
    const claimedAt = new Date(0)
    const now = scheduleMs[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe('REMINDER_DUE')
    expect(isClaimDueForFirstOrderReminder(claim, baseCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe(true)
  })

  it('is due at the second (72h) threshold after one reminder already sent', () => {
    const claimedAt = new Date(0)
    const now = scheduleMs[1]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 1, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe('REMINDER_DUE')
  })

  it('is due at the third (168h) threshold after two reminders already sent', () => {
    const claimedAt = new Date(0)
    const now = scheduleMs[2]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 2, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe('REMINDER_DUE')
  })

  it('stops after the max reminder count (schedule length) is reached', () => {
    const claim = { customerId: 'c1', claimedAt: new Date(0), remindersSent: scheduleMs.length, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now: Date.now(), conflictCustomerIds: noConflicts, scheduleMs })).toBe(
      'MAX_REMINDERS_REACHED'
    )
  })

  it('respects a shorter admin-configured schedule (e.g. 2 stages instead of 3)', () => {
    const shortSchedule = hoursToScheduleMs([24, 72])
    const claim = { customerId: 'c1', claimedAt: new Date(0), remindersSent: 2, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now: Date.now(), conflictCustomerIds: noConflicts, scheduleMs: shortSchedule })).toBe(
      'MAX_REMINDERS_REACHED'
    )
  })

  it('excludes an identity-review-flagged customer', () => {
    const claimedAt = new Date(0)
    const now = scheduleMs[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    expect(classifyFirstOrderReminderStage(claim, baseCustomer, { now, conflictCustomerIds: new Set(['c1']), scheduleMs })).toBe(
      'EXCLUDED_IDENTITY_CONFLICT'
    )
  })

  it('excludes test data', () => {
    const claimedAt = new Date(0)
    const now = scheduleMs[0]
    const claim = { customerId: 'c1', claimedAt, remindersSent: 0, redeemedAt: null }
    const testCustomer = { ...baseCustomer, email: 'jane@example.com', firstName: 'Test' }
    expect(classifyFirstOrderReminderStage(claim, testCustomer, { now, conflictCustomerIds: noConflicts, scheduleMs })).toBe('EXCLUDED_TEST_DATA')
  })
})
