// Finance reporting/aggregation (2026-08-12 Finance & Expense Intelligence
// sprint). Every function here reads from the existing authoritative
// models (Invoice/InvoiceDiscount/InvoiceRefund/InventoryLedgerEntry) plus
// the two new Finance models (FinanceExpense/InventoryPurchase) -- nothing
// here is a second copy of pricing/inventory/order totals that could drift
// (spec #45). Recognized-revenue statuses are a judgment call
// (ISSUED/REFUNDED -- a finalized invoice, whether or not it was later
// partly refunded; DRAFT/PENDING/CANCELLED/VOID never recognized), called
// out explicitly wherever it matters so it reads as "Suggested," never as
// guaranteed accounting truth (spec #46).
import { prisma } from '@/lib/prisma'
import type { InvoiceStatus } from '@prisma/client'

export const RECOGNIZED_REVENUE_STATUSES: InvoiceStatus[] = ['ISSUED', 'REFUNDED']

export interface DateRange {
  from: Date
  to: Date
}

export interface FinanceDashboardMetrics {
  range: DateRange
  grossRevenue: number
  discountsCredits: number
  netRevenue: number
  cogs: number
  cogsCoverage: { itemsWithCost: number; itemsTotal: number } // how much of netRevenue's COGS is actually known -- this field is brand new (2026-08-12), so historical coverage is expected to be low
  shippingExpense: number
  paymentProcessingFees: number
  operatingExpenses: number
  refunds: number
  estimatedGrossMargin: number
  expensesNeedingReview: number
}

export async function getFinanceDashboardMetrics(range: DateRange): Promise<FinanceDashboardMetrics> {
  // isTestData: false -- excludes the 11 known rehearsal/test invoices
  // (2026-08-18 backfill) from every revenue-recognizing query below.
  // Deliberately NOT filtering on archivedAt: archiving a real, completed
  // invoice is a filing action, not a "this wasn't real" marker -- see
  // Invoice.isTestData's own schema comment.
  const invoiceWhere = { issuedAt: { gte: range.from, lte: range.to }, status: { in: RECOGNIZED_REVENUE_STATUSES }, isTestData: false }

  const [revenueAgg, invoiceItems, shippingExpenseAgg, paymentFeesAgg, opexAgg, needsReviewCount, refundsAgg] = await Promise.all([
    prisma.invoice.aggregate({ where: invoiceWhere, _sum: { subtotal: true, discountTotal: true, total: true } }),
    prisma.invoiceItem.findMany({
      where: { invoice: invoiceWhere },
      select: { quantity: true, costOfGoods: true },
    }),
    prisma.financeExpense.aggregate({ where: { category: 'SHIPPING_POSTAGE', date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    prisma.financeExpense.aggregate({ where: { category: 'PAYMENT_PROCESSING', date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    prisma.financeExpense.aggregate({ where: { taxTreatment: 'OPERATING_EXPENSE', date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    prisma.financeExpense.count({ where: { taxTreatment: 'NEEDS_ACCOUNTANT_REVIEW', date: { gte: range.from, lte: range.to } } }),
    prisma.invoiceRefund.aggregate({ where: { status: 'COMPLETED', completedAt: { gte: range.from, lte: range.to }, invoice: { isTestData: false } }, _sum: { completedAmount: true } }),
  ])

  const itemsWithCost = invoiceItems.filter((i) => i.costOfGoods !== null)
  const cogs = itemsWithCost.reduce((sum, i) => sum + (i.costOfGoods ?? 0) * i.quantity, 0)

  const grossRevenue = revenueAgg._sum.subtotal ?? 0
  const discountsCredits = revenueAgg._sum.discountTotal ?? 0
  const netRevenue = revenueAgg._sum.total ?? 0
  const shippingExpense = shippingExpenseAgg._sum.amount ?? 0
  const paymentProcessingFees = paymentFeesAgg._sum.amount ?? 0
  const operatingExpenses = opexAgg._sum.amount ?? 0
  const refunds = refundsAgg._sum.completedAmount ?? 0

  return {
    range,
    grossRevenue,
    discountsCredits,
    netRevenue,
    cogs,
    cogsCoverage: { itemsWithCost: itemsWithCost.length, itemsTotal: invoiceItems.length },
    shippingExpense,
    paymentProcessingFees,
    operatingExpenses,
    refunds,
    estimatedGrossMargin: netRevenue - cogs - shippingExpense - paymentProcessingFees,
    expensesNeedingReview: needsReviewCount,
  }
}

export interface DiscountCreditRow {
  id: string
  invoiceNumber: string
  customerName: string
  issuedAt: Date
  label: string
  type: string
  appliedAmount: number
  source: 'PROMOTION' | 'BACKORDER_ACCOMMODATION' | 'MANUAL'
}

// Reads InvoiceDiscount only -- BackorderCompensation's own creditAppliedAmount
// is never separately summed here, since every backorder credit that's
// actually reduced a balance already has its own InvoiceDiscount row (see
// that model's own comment); summing both would double-count the same
// credit (spec #21/#29).
export async function getDiscountsCreditsReport(range: DateRange): Promise<DiscountCreditRow[]> {
  const rows = await prisma.invoiceDiscount.findMany({
    where: { invoice: { issuedAt: { gte: range.from, lte: range.to }, isTestData: false } },
    include: { invoice: { select: { invoiceNumber: true, customerName: true, issuedAt: true } }, backorderCompensation: { select: { id: true } }, promotion: { select: { id: true } } },
    orderBy: { invoice: { issuedAt: 'desc' } },
  })
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice.invoiceNumber,
    customerName: r.invoice.customerName,
    issuedAt: r.invoice.issuedAt,
    label: r.label,
    type: r.type,
    appliedAmount: r.appliedAmount,
    source: r.backorderCompensation ? 'BACKORDER_ACCOMMODATION' : r.promotion ? 'PROMOTION' : 'MANUAL',
  }))
}

export interface RefundReportRow {
  id: string
  invoiceNumber: string
  customerName: string
  completedAmount: number
  reason: string
  completedAt: Date | null
}

export async function getRefundReport(range: DateRange): Promise<RefundReportRow[]> {
  const rows = await prisma.invoiceRefund.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: range.from, lte: range.to }, invoice: { isTestData: false } },
    include: { invoice: { select: { invoiceNumber: true, customerName: true } } },
    orderBy: { completedAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice.invoiceNumber,
    customerName: r.invoice.customerName,
    completedAmount: r.completedAmount ?? 0,
    reason: r.reason,
    completedAt: r.completedAt,
  }))
}

export interface InventoryLossRow {
  id: string
  productName: string
  productSize: string
  quantity: number
  costBasis: number | null // null when the product has no supplierCaseCost/unitsPerCase to derive a per-unit cost from -- never fabricated as $0
  reason: string | null
  createdAt: Date
}

// Pure -- exported for unit testing. Cost basis, never retail value (spec
// #28): null when the product has no supplierCaseCost/unitsPerCase to
// derive a real per-unit cost from, rather than silently reporting $0.
export function deriveInventoryLossCostBasis(quantity: number, supplierCaseCost: number | null, unitsPerCase: number | null): number | null {
  if (supplierCaseCost === null || unitsPerCase === null || unitsPerCase <= 0) return null
  return (supplierCaseCost / unitsPerCase) * quantity
}

export async function getInventoryLossReport(range: DateRange): Promise<InventoryLossRow[]> {
  const rows = await prisma.inventoryLedgerEntry.findMany({
    where: { eventType: 'DAMAGE_LOSS', createdAt: { gte: range.from, lte: range.to } },
    include: { product: { select: { name: true, size: true, supplierCaseCost: true, unitsPerCase: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r) => {
    const quantity = Math.abs(r.quantityDelta)
    return {
      id: r.id,
      productName: r.product.name,
      productSize: r.product.size,
      quantity,
      costBasis: deriveInventoryLossCostBasis(quantity, r.product.supplierCaseCost, r.product.unitsPerCase),
      reason: r.reason,
      createdAt: r.createdAt,
    }
  })
}

export interface VendorReportRow {
  vendor: string
  expenseCount: number
  totalAmount: number
}

export async function getVendorReport(range: DateRange): Promise<VendorReportRow[]> {
  const rows = await prisma.financeExpense.groupBy({
    by: ['vendor'],
    where: { date: { gte: range.from, lte: range.to }, vendor: { not: null } },
    _count: { _all: true },
    _sum: { amount: true },
  })
  return rows
    .map((r) => ({ vendor: r.vendor ?? 'Unknown', expenseCount: r._count._all, totalAmount: r._sum.amount ?? 0 }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

export interface InvoiceProfitability {
  invoiceNumber: string
  grossRevenue: number
  discountsCredits: number
  netRevenue: number
  cogs: number
  cogsKnown: boolean
  linkedExpenses: number
  estimatedContribution: number
}

// Order/Customer-level profitability (spec #32) -- deliberately labeled
// "estimated" and "operational," never "taxable income" or "net profit,"
// per the spec's own disclaimer requirement.
export async function getInvoiceProfitability(invoiceId: string): Promise<InvoiceProfitability | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: { select: { quantity: true, costOfGoods: true } } },
  })
  if (!invoice) return null

  const linkedExpenses = await prisma.financeExpense.aggregate({ where: { invoiceId }, _sum: { amount: true } })

  const cogsKnown = invoice.items.every((i) => i.costOfGoods !== null) && invoice.items.length > 0
  const cogs = invoice.items.reduce((sum, i) => sum + (i.costOfGoods ?? 0) * i.quantity, 0)
  const linkedExpenseTotal = linkedExpenses._sum.amount ?? 0

  return {
    invoiceNumber: invoice.invoiceNumber,
    grossRevenue: invoice.subtotal,
    discountsCredits: invoice.discountTotal,
    netRevenue: invoice.total,
    cogs,
    cogsKnown,
    linkedExpenses: linkedExpenseTotal,
    estimatedContribution: invoice.total - cogs - linkedExpenseTotal,
  }
}
