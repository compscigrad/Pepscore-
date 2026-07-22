// Sequential invoice numbering for the standalone invoice module — separate
// from lib/orders.ts's generateInvoiceNumber() (random-suffix, still used by
// the Stripe-order invoice path) because Part 2 of the spec requires
// non-reused, sequential numbers: PS-2026-000001, PS-2026-000002, ...
//
// Backed by a persisted per-year counter (InvoiceNumberCounter) rather than
// counting existing rows: a count-based number silently gets reused if the
// invoice holding it is ever permanently deleted (the count just drops).
// The atomic `increment` update below can't race two concurrent creates onto
// the same number the way a read-then-write count could.
import { prisma } from '@/lib/prisma'

export async function generateSequentialInvoiceNumber(date = new Date()): Promise<string> {
  const year = date.getFullYear()

  // Bounded retry, not just a single attempt: the counter starts at 0 the
  // first time this table is touched for a given year, which can be behind
  // invoice numbers that already exist (e.g. seeded data, or invoices
  // created before this counter existed). Skipping past any that are
  // already taken is a one-time catch-up — once the counter passes the
  // highest existing number for the year, this loop always exits on the
  // first attempt.
  for (let attempt = 0; attempt < 20; attempt++) {
    const counter = await prisma.invoiceNumberCounter.upsert({
      where: { year },
      update: { lastSequence: { increment: 1 } },
      create: { year, lastSequence: 1 },
    })

    const candidate = `PS-${year}-${String(counter.lastSequence).padStart(6, '0')}`
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } })
    if (!existing) return candidate
  }

  throw new Error(`Could not generate a unique invoice number for ${year} after multiple attempts`)
}
