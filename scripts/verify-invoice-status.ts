// Independent verification for the Invoice.status hotfix backfill --
// re-derives the expected status per invoice from scratch and compares
// against what's stored, rather than trusting the backfill script's own
// report of what it changed.
import { prisma } from '../lib/prisma'
import { computeBackfilledStatus } from '../lib/invoice/statusBackfill'

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, status: true, balanceDue: true, amountPaid: true, paymentStatus: true },
  })

  const mismatches: Array<Record<string, unknown>> = []

  for (const inv of invoices) {
    const expected = computeBackfilledStatus(inv)
    if (expected !== inv.status) {
      mismatches.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        stored: inv.status,
        expected,
        balanceDue: inv.balanceDue,
        amountPaid: inv.amountPaid,
        paymentStatus: inv.paymentStatus,
      })
    }
  }

  console.log(JSON.stringify({
    totalInvoices: invoices.length,
    mismatchCount: mismatches.length,
    mismatches,
  }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
