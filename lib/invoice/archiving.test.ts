// Permanent regression suite for the invoice archiving feature (PRs #120-123):
// the Active/Archived/All filter clauses, the auto-archive sweep's
// eligibility rule, amount-search parsing, and month/year history scoping.
// Pure-function tests only -- the Prisma-backed behavior these functions
// feed into (archiveInvoice/restoreInvoice logging, sweepAutoArchive,
// listInvoices, getCustomerInvoiceHistory) was verified against the real
// shared database via disposable rehearsal tests at the time each PR
// merged, per this repo's convention of never running DB-mutating tests
// against the shared prod DB in the permanent CI suite.
import { describe, it, expect } from 'vitest'
import { buildFilterClause } from '../invoices'
import { isEligibleForAutoArchive, autoArchiveAnchorDate, type AutoArchiveCandidate } from './autoArchiveEligibility'
import { parseAmountSearchTerm } from './search'
import { buildPeriodDateFilter, currentPeriod } from './historyPeriod'

describe('buildFilterClause', () => {
  it('active excludes archived invoices', () => {
    expect(buildFilterClause('active')).toEqual({ archivedAt: null })
  })

  it('archived isolates only archived invoices', () => {
    expect(buildFilterClause('archived')).toEqual({ archivedAt: { not: null } })
  })

  it('all imposes no archive restriction -- the fix for the previously-misleading "all"', () => {
    expect(buildFilterClause('all')).toEqual({})
  })

  it('outstanding excludes archived and requires a positive balance on an open status', () => {
    const clause = buildFilterClause('outstanding')
    expect(clause.archivedAt).toBeNull()
    expect(clause.balanceDue).toEqual({ gt: 0 })
    expect(clause.status).toEqual({ notIn: ['CANCELLED', 'VOID'] })
  })

  it('paid excludes archived and requires paymentStatus PAID', () => {
    expect(buildFilterClause('paid')).toEqual({ archivedAt: null, paymentStatus: 'PAID' })
  })

  it('overdue excludes archived, requires a positive balance, and an issuedAt cutoff', () => {
    const clause = buildFilterClause('overdue')
    expect(clause.archivedAt).toBeNull()
    expect(clause.balanceDue).toEqual({ gt: 0 })
    expect(clause.issuedAt).toHaveProperty('lte')
  })
})

describe('isEligibleForAutoArchive', () => {
  const cutoff = new Date('2026-07-01T00:00:00Z')

  function candidate(overrides: Partial<AutoArchiveCandidate> = {}): AutoArchiveCandidate {
    return {
      paidAt: new Date('2026-06-01T00:00:00Z'),
      shipments: [],
      backorderConditions: [],
      refunds: [],
      ...overrides,
    }
  }

  it('is eligible once paidAt clears the cutoff with no shipment, backorder, or refund', () => {
    expect(isEligibleForAutoArchive(candidate(), cutoff)).toBe(true)
  })

  it('is NOT eligible when paidAt is after the cutoff (not enough time has passed)', () => {
    expect(isEligibleForAutoArchive(candidate({ paidAt: new Date('2026-07-15T00:00:00Z') }), cutoff)).toBe(false)
  })

  it('is NOT eligible with no paidAt at all', () => {
    expect(isEligibleForAutoArchive(candidate({ paidAt: null }), cutoff)).toBe(false)
  })

  it('is NOT eligible while an ACTIVE backorder condition exists, regardless of dates', () => {
    expect(isEligibleForAutoArchive(candidate({ backorderConditions: [{ status: 'ACTIVE' }] }), cutoff)).toBe(false)
  })

  it('IS eligible when every backorder condition is RESOLVED', () => {
    expect(isEligibleForAutoArchive(candidate({ backorderConditions: [{ status: 'RESOLVED' }] }), cutoff)).toBe(true)
  })

  it.each(['PENDING', 'AWAITING_MANUAL_PROCESSING', 'PROCESSING'] as const)(
    'is NOT eligible while a %s (non-terminal) refund is in flight',
    (status) => {
      expect(isEligibleForAutoArchive(candidate({ refunds: [{ status }] }), cutoff)).toBe(false)
    }
  )

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'] as const)('IS eligible once every refund is terminal (%s)', (status) => {
    expect(isEligibleForAutoArchive(candidate({ refunds: [{ status }] }), cutoff)).toBe(true)
  })

  it('is held back when a shipment delivered AFTER paidAt has not yet cleared the cutoff', () => {
    const c = candidate({
      paidAt: new Date('2026-06-01T00:00:00Z'),
      shipments: [{ createdAt: new Date('2026-06-02T00:00:00Z'), voidedAt: null, deliveredAt: new Date('2026-07-10T00:00:00Z') }],
    })
    expect(isEligibleForAutoArchive(c, cutoff)).toBe(false)
  })

  it('becomes eligible once the later shipment deliveredAt anchor itself clears the cutoff', () => {
    const c = candidate({
      paidAt: new Date('2026-05-01T00:00:00Z'),
      shipments: [{ createdAt: new Date('2026-05-02T00:00:00Z'), voidedAt: null, deliveredAt: new Date('2026-06-15T00:00:00Z') }],
    })
    expect(isEligibleForAutoArchive(c, cutoff)).toBe(true)
  })

  it('ignores a voided shipment in favor of the most recent non-voided one', () => {
    const c = candidate({
      paidAt: new Date('2026-06-01T00:00:00Z'),
      shipments: [
        { createdAt: new Date('2026-06-02T00:00:00Z'), voidedAt: new Date('2026-06-03T00:00:00Z'), deliveredAt: new Date('2026-07-20T00:00:00Z') },
        { createdAt: new Date('2026-06-05T00:00:00Z'), voidedAt: null, deliveredAt: new Date('2026-06-10T00:00:00Z') },
      ],
    })
    // The voided shipment's late deliveredAt must NOT hold this back --
    // only the live replacement shipment's earlier deliveredAt counts.
    expect(isEligibleForAutoArchive(c, cutoff)).toBe(true)
  })
})

describe('autoArchiveAnchorDate', () => {
  it('falls back to paidAt alone when no shipment has a deliveredAt', () => {
    const paidAt = new Date('2026-06-01T00:00:00Z')
    expect(autoArchiveAnchorDate({ paidAt, shipments: [] })).toEqual(paidAt)
  })

  it('never invents a date -- null paidAt and no shipment deliveredAt yields null', () => {
    expect(autoArchiveAnchorDate({ paidAt: null, shipments: [] })).toBeNull()
  })

  it('uses paidAt when it is later than the shipment deliveredAt', () => {
    const paidAt = new Date('2026-06-10T00:00:00Z')
    const anchor = autoArchiveAnchorDate({
      paidAt,
      shipments: [{ createdAt: new Date('2026-06-01T00:00:00Z'), voidedAt: null, deliveredAt: new Date('2026-06-05T00:00:00Z') }],
    })
    expect(anchor).toEqual(paidAt)
  })
})

describe('parseAmountSearchTerm', () => {
  it('parses a whole-dollar amount', () => {
    expect(parseAmountSearchTerm('150')).toBe(150)
  })

  it('parses a two-decimal amount', () => {
    expect(parseAmountSearchTerm('150.00')).toBe(150)
    expect(parseAmountSearchTerm('4217.35')).toBe(4217.35)
  })

  it('trims surrounding whitespace', () => {
    expect(parseAmountSearchTerm('  150  ')).toBe(150)
  })

  it('rejects a customer name or invoice number', () => {
    expect(parseAmountSearchTerm('Marvin Alexander')).toBeNull()
    expect(parseAmountSearchTerm('PS-2026-000024')).toBeNull()
  })

  it('rejects more than two decimal places (not a real currency amount)', () => {
    expect(parseAmountSearchTerm('150.123')).toBeNull()
  })

  it('rejects a negative number and other non-amount punctuation', () => {
    expect(parseAmountSearchTerm('-150')).toBeNull()
    expect(parseAmountSearchTerm('150-')).toBeNull()
    expect(parseAmountSearchTerm('')).toBeNull()
  })
})

describe('buildPeriodDateFilter', () => {
  it('returns no restriction for "All" (undefined period)', () => {
    expect(buildPeriodDateFilter(undefined)).toEqual({})
  })

  it('builds a [start of month, start of next month) UTC range for a given month/year', () => {
    const clause = buildPeriodDateFilter({ month: 3, year: 2026 })
    expect(clause).toEqual({
      createdAt: { gte: new Date(Date.UTC(2026, 2, 1)), lt: new Date(Date.UTC(2026, 3, 1)) },
    })
  })

  it('rolls over correctly for December into the following January', () => {
    const clause = buildPeriodDateFilter({ month: 12, year: 2026 })
    expect(clause).toEqual({
      createdAt: { gte: new Date(Date.UTC(2026, 11, 1)), lt: new Date(Date.UTC(2027, 0, 1)) },
    })
  })
})

describe('currentPeriod', () => {
  it('returns a month in 1-12 and a 4-digit year matching the real current UTC date', () => {
    const period = currentPeriod()
    const now = new Date()
    expect(period.month).toBeGreaterThanOrEqual(1)
    expect(period.month).toBeLessThanOrEqual(12)
    expect(period.month).toBe(now.getUTCMonth() + 1)
    expect(period.year).toBe(now.getUTCFullYear())
  })
})
