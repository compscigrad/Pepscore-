import { describe, it, expect } from 'vitest'
import { summarizeAdoptionAudit, computeAdoptionRates, type PortalAdoptionOverview, type PortalAdoptionEntry, type PortalAdoptionAuditReport } from './adoptionStatus'

function overview(entries: PortalAdoptionEntry[]): PortalAdoptionOverview {
  const counts: PortalAdoptionOverview['counts'] = {
    NOT_ELIGIBLE: 0,
    ELIGIBLE: 0,
    INVITE_PENDING: 0,
    INVITED: 0,
    REMINDER_1_SENT: 0,
    REMINDER_2_SENT: 0,
    PORTAL_ACTIVE: 0,
    EXCLUDED: 0,
    IDENTITY_REVIEW_REQUIRED: 0,
  }
  for (const e of entries) counts[e.status]++
  return { entries, byCustomerId: new Map(entries.map((e) => [e.customerId, e])), counts }
}

describe('summarizeAdoptionAudit', () => {
  it('reconciles customersReviewed with the total entry count', () => {
    const ov = overview([
      { customerId: 'a', status: 'PORTAL_ACTIVE', reason: null },
      { customerId: 'b', status: 'ELIGIBLE', reason: null },
    ])
    expect(summarizeAdoptionAudit(ov).customersReviewed).toBe(2)
  })

  it('sums INVITED/REMINDER_1_SENT/REMINDER_2_SENT into reminderOutstanding', () => {
    const ov = overview([
      { customerId: 'a', status: 'INVITED', reason: null },
      { customerId: 'b', status: 'REMINDER_1_SENT', reason: null },
      { customerId: 'c', status: 'REMINDER_2_SENT', reason: null },
      { customerId: 'd', status: 'ELIGIBLE', reason: null },
    ])
    expect(summarizeAdoptionAudit(ov).reminderOutstanding).toBe(3)
  })

  it('breaks excluded customers down by reason, most common first', () => {
    const ov = overview([
      { customerId: 'a', status: 'EXCLUDED', reason: 'Duplicate email/phone with another customer record' },
      { customerId: 'b', status: 'EXCLUDED', reason: 'Duplicate email/phone with another customer record' },
      { customerId: 'c', status: 'EXCLUDED', reason: 'Matches a test/QA data pattern' },
    ])
    const report = summarizeAdoptionAudit(ov)
    expect(report.excludedTotal).toBe(3)
    expect(report.excludedByReason).toEqual([
      { reason: 'Duplicate email/phone with another customer record', count: 2 },
      { reason: 'Matches a test/QA data pattern', count: 1 },
    ])
  })

  it('an excluded entry with no reason falls back to "Other" rather than being dropped', () => {
    const ov = overview([{ customerId: 'a', status: 'EXCLUDED', reason: null }])
    expect(summarizeAdoptionAudit(ov).excludedByReason).toEqual([{ reason: 'Other', count: 1 }])
  })

  it('suppressed is always 0 -- not a modeled adoption status today', () => {
    expect(summarizeAdoptionAudit(overview([])).suppressed).toBe(0)
  })

  it('an empty overview produces an all-zero report, not an error', () => {
    const report = summarizeAdoptionAudit(overview([]))
    expect(report.customersReviewed).toBe(0)
    expect(report.excludedByReason).toEqual([])
  })
})

function report(overrides: Partial<PortalAdoptionAuditReport>): PortalAdoptionAuditReport {
  return {
    customersReviewed: 0,
    portalActive: 0,
    invitationPending: 0,
    eligibleNotYetInvited: 0,
    reminderOutstanding: 0,
    identityReviewRequired: 0,
    excludedTotal: 0,
    excludedByReason: [],
    notEligible: 0,
    suppressed: 0,
    ...overrides,
  }
}

describe('computeAdoptionRates', () => {
  it('computes activationRate as portalActive / customersReviewed', () => {
    const rates = computeAdoptionRates(report({ customersReviewed: 10, portalActive: 4 }), 0, 0)
    expect(rates.activationRate).toBe(0.4)
  })

  it('sums eligible/pending/reminder/review into pendingAdoptionRate, excluding notEligible and excludedTotal', () => {
    const rates = computeAdoptionRates(
      report({ customersReviewed: 10, eligibleNotYetInvited: 1, invitationPending: 1, reminderOutstanding: 2, identityReviewRequired: 1, notEligible: 3, excludedTotal: 2 }),
      0,
      0
    )
    expect(rates.pendingAdoptionRate).toBe(0.5)
  })

  it('returns null (not 0) inviteConversionRate when nobody has ever been invited', () => {
    const rates = computeAdoptionRates(report({ customersReviewed: 5 }), 0, 0)
    expect(rates.inviteConversionRate).toBeNull()
  })

  it('computes inviteConversionRate as everInvitedNowActive / everInvited', () => {
    const rates = computeAdoptionRates(report({ customersReviewed: 10 }), 8, 6)
    expect(rates.inviteConversionRate).toBe(0.75)
  })

  it('an empty base (zero customers) produces zero rates, not NaN or a divide-by-zero error', () => {
    const rates = computeAdoptionRates(report({ customersReviewed: 0 }), 0, 0)
    expect(rates.activationRate).toBe(0)
    expect(rates.pendingAdoptionRate).toBe(0)
    expect(rates.inviteConversionRate).toBeNull()
  })
})
