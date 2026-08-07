// One-off recovery for the address gap in scripts/backfill-invoice-customer-
// linkage.ts (2026-08-06/07): that script created new Customer rows for 4
// orphaned-invoice people but only copied name/email/phone, never the
// billing/shipping address that was sitting right there in the invoice
// snapshot. This recovers it the same deterministic way
// lib/customers/linkageBackfill.ts's pickMostRecentAddress() now does for
// any *future* run of that script: when a person has more than one
// invoice with slightly different address snapshots (Marvin Alexander's
// case -- "650 S Spring Street" vs "650 South Spring Street"), the
// most-recently-created invoice's address wins. Every invoice snapshot
// stays untouched either way -- this only ever writes Customer.
// billingAddress/shippingAddress, and only when they're currently null
// (never overwrites an address an admin may have already entered by hand).
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { pickMostRecentAddress } from '../lib/customers/linkageBackfill'
import { recordCustomerActivity } from '../lib/customers'

const ACTOR = 'system-address-backfill'
const TARGET_NAMES: [string, string][] = [
  ['Marvin', 'Alexander'],
  ['Micaela', 'Soto'],
  ['James', 'Purtue'],
  ['Michael', 'Redmond'],
]

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const results: Array<Record<string, unknown>> = []

  for (const [firstName, lastName] of TARGET_NAMES) {
    const customer = await prisma.customer.findFirst({ where: { firstName, lastName } })
    if (!customer) {
      results.push({ name: `${firstName} ${lastName}`, skipped: 'not found' })
      continue
    }
    if (customer.billingAddress || customer.shippingAddress) {
      results.push({ name: `${firstName} ${lastName}`, skipped: 'already has an address on file — not overwriting' })
      continue
    }

    const invoices = await prisma.invoice.findMany({
      where: { customerId: customer.id },
      select: { id: true, invoiceNumber: true, billingAddress: true, shippingAddress: true, customerName: true, customerEmail: true, customerPhone: true, createdAt: true },
    })
    const picked = pickMostRecentAddress(
      invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        customerName: i.customerName,
        customerEmail: i.customerEmail,
        customerPhone: i.customerPhone,
        billingAddress: i.billingAddress,
        shippingAddress: i.shippingAddress,
        createdAt: i.createdAt,
      }))
    )

    if (!picked.sourceInvoiceNumber) {
      results.push({ name: `${firstName} ${lastName}`, skipped: 'no address found on any linked invoice' })
      continue
    }

    if (!dryRun) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { billingAddress: picked.billingAddress as never, shippingAddress: picked.shippingAddress as never },
      })
      await recordCustomerActivity({
        customerId: customer.id,
        eventType: 'ADDRESS_RECOVERED_FROM_INVOICE_SNAPSHOT',
        newValue: `Recovered from ${picked.sourceInvoiceNumber} (most recent invoice with an address on file)`,
        source: 'SYSTEM',
        userId: ACTOR,
      })
      await prisma.adminAuditLog.create({
        data: {
          action: 'RECOVER_CUSTOMER_ADDRESS',
          entity: 'Customer',
          entityId: customer.id,
          adminId: ACTOR,
          details: { sourceInvoiceNumber: picked.sourceInvoiceNumber, billingAddress: picked.billingAddress, shippingAddress: picked.shippingAddress } as Prisma.InputJsonValue,
        },
      })
    }

    results.push({ name: `${firstName} ${lastName}`, customerId: customer.id, recoveredFrom: picked.sourceInvoiceNumber, address: picked.billingAddress })
  }

  console.log(JSON.stringify({ mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED', results }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
