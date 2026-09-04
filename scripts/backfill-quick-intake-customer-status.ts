// One-off recovery (2026-09-03 customer lifecycle sprint) for the Quick
// Intake bug fixed in app/api/admin/invoices/quick-intake/route.ts: that
// route built its invoice via a raw prisma.invoice.create() instead of
// lib/invoices.ts's createInvoice(), so it never called
// syncCustomerFromInvoiceEvent() -- every customer created through it kept
// Customer.status at the Prisma default (LEAD) forever, regardless of the
// real DRAFT invoice sitting right there, which incorrectly read as
// portal-ineligible ("no invoice issued yet"). This runs the exact same
// canonical recomputeAndSaveCustomerStatus() the fixed route now calls
// automatically going forward, targeted at the customers actually found in
// this state by a live-database audit -- never a blind mass mutation.
import { prisma } from '../lib/prisma'
import { recomputeAndSaveCustomerStatus } from '../lib/customers'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const affected = await prisma.customer.findMany({
    where: {
      status: { in: ['LEAD', 'INTAKE_SENT', 'INTAKE_COMPLETED'] },
      leadStatus: { not: 'CONVERTED' },
      invoices: { some: { deletedAt: null } },
    },
    select: { id: true, firstName: true, lastName: true, status: true },
  })

  console.log(`Found ${affected.length} customer(s) with a real invoice but a stale lead-stage status.`)

  const results: Array<Record<string, unknown>> = []
  for (const customer of affected) {
    const before = customer.status
    const after = dryRun ? '(dry-run, not computed)' : await recomputeAndSaveCustomerStatus(customer.id)
    results.push({ id: customer.id, name: `${customer.firstName} ${customer.lastName}`.trim(), before, after })
  }

  console.table(results)
  console.log(dryRun ? 'Dry run -- no writes made. Re-run without --dry-run to apply.' : 'Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
