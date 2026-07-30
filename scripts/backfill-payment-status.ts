// One-time Phase 1 backfill — run once, after `prisma db push` applies the
// new columns and before (or immediately alongside, well ahead of real
// traffic) the code that reads them deploys.
//
// `db push`'s `DEFAULT 'UNPAID'` on the new Invoice.paymentStatus column is a
// static value applied to every existing row — Postgres ADD COLUMN defaults
// are constants, not per-row computed expressions. This script replaces that
// static default with the real per-row value, using the exact same tested
// derivation functions the live application uses (lib/invoice/status.ts) —
// not a reimplementation, so there is zero risk of the backfill and the
// runtime logic disagreeing.
import { prisma } from '../lib/prisma'
import { deriveInvoicePaymentAmounts, deriveInitialPaymentIntentStatus } from '../lib/invoice/status'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, status: true, amountPaid: true, total: true, balanceDue: true },
  })

  let changed = 0
  const changes: Array<Record<string, unknown>> = []

  for (const inv of invoices) {
    const derived = deriveInvoicePaymentAmounts(inv.amountPaid, inv.total)
    // paymentIntentStatus only means something for an invoice that has been
    // issued at least once — a still-DRAFT invoice keeps the schema default
    // (NOT_AVAILABLE), matching deriveInitialPaymentIntentStatus's own
    // contract (it's the *issuance-moment* intent, not a draft's).
    const paymentIntentStatus = inv.status === 'DRAFT' ? 'NOT_AVAILABLE' : deriveInitialPaymentIntentStatus(derived.balanceDue)

    const balanceDueDrift = Math.round((derived.balanceDue - inv.balanceDue) * 100) / 100

    changes.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      amountPaid: inv.amountPaid,
      total: inv.total,
      existingBalanceDue: inv.balanceDue,
      derivedBalanceDue: derived.balanceDue,
      balanceDueDrift, // should be 0 for every row — balanceDue already existed pre-Phase-1
      newPaymentStatus: derived.paymentStatus,
      newOverpaidAmount: derived.overpaidAmount,
      newPaymentIntentStatus: paymentIntentStatus,
    })

    if (!dryRun) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          paymentStatus: derived.paymentStatus,
          overpaidAmount: derived.overpaidAmount,
          paymentIntentStatus,
        },
      })
    }
    changed++
  }

  console.log(JSON.stringify({ mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED', totalInvoices: invoices.length, changed, changes }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
