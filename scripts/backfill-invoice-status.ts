// Hotfix backfill for the Invoice.status staleness gap left by
// scripts/backfill-payment-status.ts (see lib/invoice/statusBackfill.ts for
// the root-cause note). Writes ONLY the `status` column -- paymentStatus,
// balances, payments, line items, and customer data are never touched.
import { prisma } from '../lib/prisma'
import { computeBackfilledStatus } from '../lib/invoice/statusBackfill'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, status: true, balanceDue: true, amountPaid: true, paymentStatus: true },
  })

  const changes: Array<Record<string, unknown>> = []

  for (const inv of invoices) {
    const newStatus = computeBackfilledStatus(inv)
    if (newStatus === inv.status) continue

    changes.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      oldStatus: inv.status,
      newStatus,
      balanceDue: inv.balanceDue,
      amountPaid: inv.amountPaid,
      paymentStatus: inv.paymentStatus,
    })

    if (!dryRun) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: newStatus } })
    }
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED',
    totalInvoices: invoices.length,
    changedCount: changes.length,
    changes,
  }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
