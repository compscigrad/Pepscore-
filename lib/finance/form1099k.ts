// 1099-K Reconciliation (2026-08-18 Finance Center sprint). Processor
// gross-receipts reporting (Stripe's 1099-K) typically does NOT subtract
// refunds, fees, discounts, or shipping -- this exists to explain the
// difference between that raw figure and Pepscore's own book gross, never
// to assume they should already match. The processor figure itself is
// entered manually (no automated 1099-K import exists); everything else
// is computed live from existing records.
import { prisma } from '@/lib/prisma'
import { getFinanceDashboardMetrics } from './reports'

export interface Form1099KRecord {
  taxYear: number
  processorReportedGross: number | null
  notes: string | null
  enteredBy: string | null
  enteredAt: Date | null
}

export async function getForm1099KRecord(taxYear: number): Promise<Form1099KRecord | null> {
  return prisma.form1099KReconciliation.findUnique({ where: { taxYear } })
}

export async function upsertForm1099KRecord(taxYear: number, processorReportedGross: number | null, notes: string | null, actorId: string): Promise<Form1099KRecord> {
  const record = await prisma.form1099KReconciliation.upsert({
    where: { taxYear },
    create: { taxYear, processorReportedGross, notes, enteredBy: actorId, enteredAt: new Date() },
    update: { processorReportedGross, notes, enteredBy: actorId, enteredAt: new Date() },
  })
  await prisma.adminAuditLog.create({
    data: { action: 'FORM_1099K_RECORDED', entity: 'Form1099KReconciliation', entityId: record.id, adminId: actorId, details: { taxYear, processorReportedGross } },
  })
  return record
}

export interface Form1099KReconciliationReport {
  taxYear: number
  processorReportedGross: number | null // null until the owner enters it
  bookGross: number
  refunds: number
  fees: number
  shipping: number // shipping revenue collected from customers, not shipping cost -- always 0 today, see docs/launch/CheckoutShippingOptions.md
  tax: number
  adjustments: number // discounts -- the one deduction category not already covered by refunds/fees/shipping/tax above
  difference: number | null // processorReportedGross - bookGross, null if processor figure not yet entered
  notes: string | null
}

export async function getForm1099KReconciliationReport(taxYear: number): Promise<Form1099KReconciliationReport> {
  const from = new Date(taxYear, 0, 1)
  const to = new Date(taxYear, 11, 31, 23, 59, 59, 999)

  const [record, metrics, taxAgg] = await Promise.all([
    getForm1099KRecord(taxYear),
    getFinanceDashboardMetrics({ from, to }),
    prisma.invoice.aggregate({
      where: { issuedAt: { gte: from, lte: to }, status: { in: ['ISSUED', 'REFUNDED'] }, isTestData: false },
      _sum: { tax: true },
    }),
  ])

  const bookGross = metrics.grossRevenue
  const tax = taxAgg._sum.tax ?? 0
  const processorReportedGross = record?.processorReportedGross ?? null

  return {
    taxYear,
    processorReportedGross,
    bookGross,
    refunds: metrics.refunds,
    fees: metrics.paymentProcessingFees,
    shipping: 0,
    tax,
    adjustments: metrics.discountsCredits,
    difference: processorReportedGross !== null ? processorReportedGross - bookGross : null,
    notes: record?.notes ?? null,
  }
}
