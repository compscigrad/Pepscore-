// Separate file from a hypothetical lib/invoices.test.ts -- lib/invoices.ts
// is otherwise entirely DB-orchestration (the module's own header: "the
// ONLY module that queries Prisma for invoice data"), matching this
// repo's established convention of not unit-testing that layer. This
// covers only buildFilterClause, the one genuinely pure function in the
// file -- it decides which invoices appear under each admin filter tab,
// so a wrong clause here silently hides or wrongly shows real invoices.
import { describe, it, expect } from 'vitest'
import { buildFilterClause } from './invoices'

describe('buildFilterClause', () => {
  it('active (and the default) excludes only archived invoices', () => {
    expect(buildFilterClause('active')).toEqual({ archivedAt: null })
  })

  it('archived includes only invoices with a non-null archivedAt', () => {
    expect(buildFilterClause('archived')).toEqual({ archivedAt: { not: null } })
  })

  it('all applies no filter at all -- the one case that must include archived invoices too', () => {
    expect(buildFilterClause('all')).toEqual({})
  })

  it('outstanding excludes archived, requires a positive balance, and excludes CANCELLED/VOID', () => {
    const clause = buildFilterClause('outstanding')
    expect(clause).toEqual({
      archivedAt: null,
      balanceDue: { gt: 0 },
      status: { notIn: ['CANCELLED', 'VOID'] },
    })
  })

  it('paid excludes archived and requires paymentStatus PAID', () => {
    expect(buildFilterClause('paid')).toEqual({ archivedAt: null, paymentStatus: 'PAID' })
  })

  it('overdue requires a positive balance, excludes CANCELLED/VOID, and cuts off at approximately 30 days ago', () => {
    const before = Date.now()
    const clause = buildFilterClause('overdue') as {
      archivedAt: null
      balanceDue: { gt: number }
      status: { notIn: string[] }
      issuedAt: { lte: Date }
    }
    const after = Date.now()

    expect(clause.archivedAt).toBeNull()
    expect(clause.balanceDue).toEqual({ gt: 0 })
    expect(clause.status).toEqual({ notIn: ['CANCELLED', 'VOID'] })

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    const cutoffMs = clause.issuedAt.lte.getTime()
    // The cutoff is computed as "now minus 30 days" at call time -- assert
    // it falls within the [before, after] call window rather than pinning
    // an exact timestamp, so this test can't flake on slow CI.
    expect(cutoffMs).toBeGreaterThanOrEqual(before - THIRTY_DAYS_MS - 1000)
    expect(cutoffMs).toBeLessThanOrEqual(after - THIRTY_DAYS_MS + 1000)
  })

  it('an unrecognized filter value falls back to the active behavior (default case)', () => {
    expect(buildFilterClause('not-a-real-filter' as never)).toEqual({ archivedAt: null })
  })
})
