// Post-backfill verification — independently recomputes the expected
// paymentStatus/balanceDue/overpaidAmount for every invoice from its actual
// amountPaid/total (the same two fields the app has always treated as
// authoritative) and compares against what's stored, rather than just
// reporting the distribution of whatever ended up in the column.
//
// Known, honest limitation: this repo has no structured refund/credit model
// today — InvoicePayment.amount is constrained to strictly positive
// (lib/invoice/validation.ts's paymentPayloadSchema: `z.number().positive()`)
// and there is no separate refund/credit table or signed-amount convention.
// InvoicePaymentStatus.REFUNDED exists in the enum but no code path ever
// produces it. So this script cannot verify "against refunds and credits" —
// there is no structured data to verify against. What it does instead:
// flags every invoice whose legacy Invoice.status is REFUNDED, CANCELLED, or
// VOID for manual review, since amountPaid may not reflect money that left
// the business outside this system's payment-recording flow.
import { prisma } from '../lib/prisma'
import { deriveInvoicePaymentAmounts } from '../lib/invoice/status'

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, status: true, amountPaid: true, total: true, balanceDue: true, paymentStatus: true, overpaidAmount: true },
  })

  const mismatches: unknown[] = []
  const needsManualReview: unknown[] = []

  for (const inv of invoices) {
    const expected = deriveInvoicePaymentAmounts(inv.amountPaid, inv.total)
    const paymentStatusMatches = expected.paymentStatus === inv.paymentStatus
    const balanceDueMatches = Math.abs(expected.balanceDue - inv.balanceDue) < 0.01
    const overpaidMatches = Math.abs(expected.overpaidAmount - inv.overpaidAmount) < 0.01

    if (!paymentStatusMatches || !balanceDueMatches || !overpaidMatches) {
      mismatches.push({
        id: inv.id, invoiceNumber: inv.invoiceNumber,
        stored: { paymentStatus: inv.paymentStatus, balanceDue: inv.balanceDue, overpaidAmount: inv.overpaidAmount },
        expected,
      })
    }

    if (['REFUNDED', 'CANCELLED', 'VOID'].includes(inv.status)) {
      needsManualReview.push({
        id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status,
        amountPaid: inv.amountPaid, derivedPaymentStatus: expected.paymentStatus,
        note: 'No structured refund/credit record exists in this system — verify against real-world records manually.',
      })
    }
  }

  console.log(JSON.stringify({
    totalInvoices: invoices.length,
    mismatchCount: mismatches.length,
    mismatches,
    needsManualReviewCount: needsManualReview.length,
    needsManualReview,
  }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
