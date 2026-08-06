// Backfill for invoices issued without ever being linked to a Customer
// record (Invoice.customerId is optional at creation time -- see
// lib/invoices.ts's createInvoice). Root cause and full audit trail: the
// 2026-08-06 rollout incident review (Marvin Alexander / PS-2026-000020).
//
// Writes ONLY:
//   - Invoice.customerId (previously null -> a real Customer id)
//   - a newly-created Customer row, when no existing one matches
//   - CustomerActivityLog + AdminAuditLog entries documenting the backfill
// Never touches Invoice.customerName/customerEmail/customerPhone (the
// point-in-time issued snapshot) or any other invoice field.
//
// Categorization logic lives in lib/customers/linkageBackfill.ts (unit
// tested, DB-free). This script is the thin, once-run I/O wrapper --
// mirrors scripts/backfill-invoice-status.ts's --dry-run convention.
import { prisma } from '../lib/prisma'
import { createCustomer, syncCustomerFromInvoiceEvent } from '../lib/customers'
import { planLinkageBackfill, splitName } from '../lib/customers/linkageBackfill'
import type { OrphanInvoiceSnapshot, ExistingCustomerCandidate } from '../lib/customers/linkageBackfill'

const ACTOR = 'system-linkage-backfill'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const orphanInvoices: OrphanInvoiceSnapshot[] = await prisma.invoice.findMany({
    where: { customerId: null },
    select: { id: true, invoiceNumber: true, customerName: true, customerEmail: true, customerPhone: true },
  })
  const existingCustomers: ExistingCustomerCandidate[] = await prisma.customer.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  })

  const plan = planLinkageBackfill(orphanInvoices, existingCustomers)

  const applied: Array<Record<string, unknown>> = []

  for (const group of plan.safeCreateNew) {
    const { firstName, lastName } = splitName(group.name)
    let customerId: string
    if (!dryRun) {
      const customer = await createCustomer({ firstName, lastName, email: group.email, phone: group.phone })
      customerId = customer.id
      for (const inv of group.invoices) {
        await prisma.invoice.update({ where: { id: inv.id }, data: { customerId } })
        await syncCustomerFromInvoiceEvent({
          customerId,
          invoiceId: inv.id,
          eventType: 'INVOICE_CUSTOMER_LINKAGE_BACKFILLED',
          newValue: `Linked ${inv.invoiceNumber} to newly-created Customer record during production data audit`,
          source: 'SYSTEM',
          userId: ACTOR,
        })
      }
      await prisma.adminAuditLog.create({
        data: {
          action: 'BACKFILL_INVOICE_CUSTOMER_LINKAGE',
          entity: 'Customer',
          entityId: customerId,
          adminId: ACTOR,
          details: { createdNewCustomer: true, invoiceNumbers: group.invoices.map((i) => i.invoiceNumber), email: group.email, phone: group.phone },
        },
      })
    } else {
      customerId = '(dry-run, not created)'
    }
    applied.push({ action: 'CREATE_AND_LINK', name: group.name, email: group.email, invoices: group.invoices.map((i) => i.invoiceNumber), customerId })
  }

  for (const group of plan.safeLinkExisting) {
    const candidate = group.existingCandidates[0]
    if (!dryRun) {
      for (const inv of group.invoices) {
        await prisma.invoice.update({ where: { id: inv.id }, data: { customerId: candidate.id } })
        await syncCustomerFromInvoiceEvent({
          customerId: candidate.id,
          invoiceId: inv.id,
          eventType: 'INVOICE_CUSTOMER_LINKAGE_BACKFILLED',
          newValue: `Linked ${inv.invoiceNumber} to existing Customer record during production data audit`,
          source: 'SYSTEM',
          userId: ACTOR,
        })
      }
      await prisma.adminAuditLog.create({
        data: {
          action: 'BACKFILL_INVOICE_CUSTOMER_LINKAGE',
          entity: 'Customer',
          entityId: candidate.id,
          adminId: ACTOR,
          details: { createdNewCustomer: false, invoiceNumbers: group.invoices.map((i) => i.invoiceNumber) },
        },
      })
    }
    applied.push({ action: 'LINK_EXISTING', name: group.name, existingCustomerId: candidate.id, invoices: group.invoices.map((i) => i.invoiceNumber) })
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED',
    totalOrphanedInvoices: orphanInvoices.length,
    applied,
    skipped: {
      noContactInfo: plan.noContact.map((i) => i.invoiceNumber),
      testDataExcluded: plan.testData.map((g) => ({ name: g.name, email: g.email, invoices: g.invoices.map((i) => i.invoiceNumber) })),
      ambiguousRoutedToReview: plan.ambiguous.map((g) => ({
        name: g.name,
        invoices: g.invoices.map((i) => i.invoiceNumber),
        candidates: g.existingCandidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
      })),
    },
  }, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
