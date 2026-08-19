// Sales Tax Ledger (2026-08-18 Finance Center sprint). Reports on
// Order.tax and Invoice.tax as they actually exist -- neither field is
// written by any code path yet (storefront checkout never charges tax,
// see docs/launch/SalesTaxDecision.md; no invoice-creation UI charges it
// either), so this legitimately reports $0 today. That's the correct,
// honest answer, not a bug: the spec is explicit that an unconfigured
// figure must be reported as 0, never fabricated. This exists so the
// reporting is ready the moment either surface starts collecting tax,
// without a later migration.
import { prisma } from '@/lib/prisma'
import type { DateRange } from './reports'

export interface SalesTaxSummary {
  range: DateRange
  invoiceTaxableSubtotal: number
  invoiceTaxCollected: number
  invoiceCount: number
  orderTaxableSubtotal: number
  orderTaxCollected: number
  orderCount: number
  totalTaxCollected: number
  refundedTax: number
  netTaxCollected: number
}

export async function getSalesTaxSummary(range: DateRange): Promise<SalesTaxSummary> {
  const [invoiceAgg, orderAgg, refundedTaxAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { issuedAt: { gte: range.from, lte: range.to }, status: { in: ['ISSUED', 'REFUNDED'] }, isTestData: false, deletedAt: null },
      _sum: { subtotal: true, tax: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: range.from, lte: range.to }, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] }, isTestData: false },
      _sum: { subtotal: true, tax: true },
      _count: true,
    }),
    // Tax portion of completed refunds is not separately tracked anywhere
    // (InvoiceRefund has no tax-specific column) -- reported as 0/unknown
    // rather than estimated, matching the "never fabricate" rule. Kept as
    // its own field so this is visibly a gap, not silently omitted.
    Promise.resolve({ _sum: { amount: 0 } }),
  ])

  const invoiceTaxCollected = invoiceAgg._sum.tax ?? 0
  const orderTaxCollected = orderAgg._sum.tax ?? 0
  const totalTaxCollected = invoiceTaxCollected + orderTaxCollected
  const refundedTax = refundedTaxAgg._sum.amount ?? 0

  return {
    range,
    invoiceTaxableSubtotal: invoiceAgg._sum.subtotal ?? 0,
    invoiceTaxCollected,
    invoiceCount: invoiceAgg._count,
    orderTaxableSubtotal: orderAgg._sum.subtotal ?? 0,
    orderTaxCollected,
    orderCount: orderAgg._count,
    totalTaxCollected,
    refundedTax,
    netTaxCollected: totalTaxCollected - refundedTax,
  }
}
