// Shared month/year scoping for invoice history views (Customer Portal's
// /account/invoices and the admin customer profile's Invoices section) --
// both default to the current calendar month with a Month/Year picker plus
// an explicit "All" escape hatch, per the spec's "current information stays
// immediately visible, history stays reachable without cluttering the
// active view" principle. Deliberately opt-in: callers that need every
// invoice regardless of date (e.g. the portal Support page's invoice
// picker) simply don't pass a period.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface InvoiceHistoryPeriod {
  month: number // 1-12
  year: number
}

export function currentPeriod(): InvoiceHistoryPeriod {
  const now = new Date()
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() }
}

// undefined => no date restriction ("All"). A concrete period => that
// calendar month, in UTC to match how the rest of the invoice module
// treats dates (see docs/Decisions.md #21's paidAt-cutoff convention).
export function buildPeriodDateFilter(period: InvoiceHistoryPeriod | undefined): Prisma.InvoiceWhereInput {
  if (!period) return {}
  const start = new Date(Date.UTC(period.year, period.month - 1, 1))
  const end = new Date(Date.UTC(period.year, period.month, 1))
  return { createdAt: { gte: start, lt: end } }
}

// For populating a Year <select> -- the true range of years this
// customer actually has invoices in, never a guessed/fixed window.
export async function getInvoiceHistoryYearRange(customerId: string): Promise<{ minYear: number; maxYear: number } | null> {
  const agg = await prisma.invoice.aggregate({
    where: { customerId, deletedAt: null },
    _min: { createdAt: true },
    _max: { createdAt: true },
  })
  if (!agg._min.createdAt || !agg._max.createdAt) return null
  return { minYear: agg._min.createdAt.getUTCFullYear(), maxYear: agg._max.createdAt.getUTCFullYear() }
}
