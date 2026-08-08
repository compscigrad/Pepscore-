import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isInviteDueForReminder, classifyReminderStage, type ReminderEligibilityInvite, type ReminderEligibilityCustomer } from './reminderEligibility'

// getPortalInviteState() reads the real wall-clock `new Date()` internally
// (not an injectable clock), so each test fixes system time to match the
// `now` it exercises -- otherwise a fixed historical `expiresAt` would read
// as EXPIRED (or not) against whatever the real current date happens to be
// rather than the instant the test actually means to simulate.
const DAY = 24 * 60 * 60 * 1000
const CREATED = new Date('2026-08-01T00:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function invite(overrides: Partial<ReminderEligibilityInvite> = {}): ReminderEligibilityInvite {
  return {
    customerId: 'cust1',
    createdAt: new Date(CREATED),
    remindersSent: 0,
    claimedAt: null,
    revokedAt: null,
    expiresAt: new Date(CREATED + 7 * DAY),
    ...overrides,
  }
}

function customer(overrides: Partial<ReminderEligibilityCustomer> = {}): ReminderEligibilityCustomer {
  // Deliberately NOT an example.com/.org/.net/test.com address -- those are
  // the exact domains looksLikeTestData() treats as test data (see the
  // dedicated "test-domain email" case below), and every other test in this
  // file needs a customer that is NOT excluded for that reason.
  return { firstName: 'Jane', lastName: 'Doe', email: 'jane@realmail.example', ...overrides }
}

const noConflicts = new Set<string>()

describe('isInviteDueForReminder', () => {
  it('is NOT due before day 3 has elapsed', () => {
    const now = CREATED + 2 * DAY
    vi.setSystemTime(now)
    expect(isInviteDueForReminder(invite(), customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('is due exactly at the day-3 mark for a first reminder (remindersSent 0)', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    expect(isInviteDueForReminder(invite({ remindersSent: 0 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe(true)
  })

  it('is NOT due for a second reminder until day 6, even though day 3 has passed', () => {
    const now = CREATED + 4 * DAY
    vi.setSystemTime(now)
    expect(isInviteDueForReminder(invite({ remindersSent: 1 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('is due at day 6 for a second reminder (remindersSent 1)', () => {
    const now = CREATED + 6 * DAY
    vi.setSystemTime(now)
    expect(isInviteDueForReminder(invite({ remindersSent: 1 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe(true)
  })

  it('is never due once 2 reminders have already been sent (no third reminder)', () => {
    // Deliberately still inside the 7-day expiry window so EXPIRED never
    // masks the remindersSent-cap behavior this test actually targets.
    const now = CREATED + 6.5 * DAY
    vi.setSystemTime(now)
    expect(isInviteDueForReminder(invite({ remindersSent: 2 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('a claimed invite is never due', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    const claimed = invite({ claimedAt: new Date(CREATED + 1 * DAY) })
    expect(isInviteDueForReminder(claimed, customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('a revoked invite is never due', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    const revoked = invite({ revokedAt: new Date(CREATED + 1 * DAY) })
    expect(isInviteDueForReminder(revoked, customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('an expired invite is never due', () => {
    const now = CREATED + 10 * DAY
    vi.setSystemTime(now)
    const expired = invite({ expiresAt: new Date(CREATED + 7 * DAY) })
    expect(isInviteDueForReminder(expired, customer(), { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('a customer with an open identity-conflict case is excluded even if otherwise due', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    const conflicted = new Set(['cust1'])
    expect(isInviteDueForReminder(invite(), customer(), { now, conflictCustomerIds: conflicted })).toBe(false)
  })

  it('a test/QA-named customer is excluded even if otherwise due', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    const testCustomer = customer({ firstName: 'QA', lastName: 'Test' })
    expect(isInviteDueForReminder(invite(), testCustomer, { now, conflictCustomerIds: noConflicts })).toBe(false)
  })

  it('a customer with a test-domain email is excluded even if otherwise due', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    const testCustomer = customer({ email: 'someone@example.com' })
    expect(isInviteDueForReminder(invite(), testCustomer, { now, conflictCustomerIds: noConflicts })).toBe(false)
  })
})

describe('classifyReminderStage', () => {
  it('returns NOT_YET_DUE before day 3', () => {
    const now = CREATED + 1 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite(), customer(), { now, conflictCustomerIds: noConflicts })).toBe('NOT_YET_DUE')
  })

  it('returns DAY_3_DUE at the day-3 mark for a first reminder', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite({ remindersSent: 0 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe('DAY_3_DUE')
  })

  it('returns DAY_6_DUE at the day-6 mark for a second reminder', () => {
    const now = CREATED + 6 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite({ remindersSent: 1 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe('DAY_6_DUE')
  })

  it('returns MAX_REMINDERS_REACHED once both reminders are already sent, distinct from NOT_YET_DUE', () => {
    const now = CREATED + 6.5 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite({ remindersSent: 2 }), customer(), { now, conflictCustomerIds: noConflicts })).toBe('MAX_REMINDERS_REACHED')
  })

  it('returns EXCLUDED_NOT_ACTIVE for a claimed, revoked, or expired invite', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite({ claimedAt: new Date(CREATED) }), customer(), { now, conflictCustomerIds: noConflicts })).toBe('EXCLUDED_NOT_ACTIVE')
    expect(classifyReminderStage(invite({ revokedAt: new Date(CREATED) }), customer(), { now, conflictCustomerIds: noConflicts })).toBe('EXCLUDED_NOT_ACTIVE')
  })

  it('returns EXCLUDED_IDENTITY_CONFLICT distinctly from EXCLUDED_TEST_DATA', () => {
    const now = CREATED + 3 * DAY
    vi.setSystemTime(now)
    expect(classifyReminderStage(invite(), customer(), { now, conflictCustomerIds: new Set(['cust1']) })).toBe('EXCLUDED_IDENTITY_CONFLICT')
    expect(classifyReminderStage(invite(), customer({ firstName: 'QA' }), { now, conflictCustomerIds: noConflicts })).toBe('EXCLUDED_TEST_DATA')
  })
})
