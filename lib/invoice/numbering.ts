// Sequential invoice numbering for the standalone invoice module — separate
// from lib/orders.ts's generateInvoiceNumber() (random-suffix, still used by
// the Stripe-order invoice path) because Part 2 of the spec requires
// non-reused, sequential numbers: PS-2026-000001, PS-2026-000002, ...
import { prisma } from '@/lib/prisma'

export async function generateSequentialInvoiceNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear()
  const prefix = `PS-${year}-`

  // Count only this year's invoices so numbering restarts at 000001 each year.
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`)
  const countThisYear = await prisma.invoice.count({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
  })

  const sequence = String(countThisYear + 1).padStart(6, '0')
  const candidate = `${prefix}${sequence}`

  // Extremely unlikely (would require a concurrent create between count and
  // insert), but the unique constraint on invoiceNumber means a collision
  // would otherwise surface as an opaque DB error — resolve it here instead.
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } })
  if (existing) {
    return generateSequentialInvoiceNumber(date)
  }

  return candidate
}
