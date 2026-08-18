// Assembles the Finance workbook's data (2026-08-12 Finance sprint) --
// calls the same report functions the dashboard/report pages use, so the
// export can never show different numbers than what's on screen. Pure data
// assembly; lib/export.ts owns the actual XLSX/CSV writing.
import type { DateRange } from '@/lib/finance/reports'
import {
  getFinanceDashboardMetrics,
  getDiscountsCreditsReport,
  getRefundReport,
  getInventoryLossReport,
  getVendorReport,
} from '@/lib/finance/reports'
import { listExpenses } from '@/lib/finance/expenses'
import { listInventoryPurchases } from '@/lib/finance/inventoryPurchases'
import { getSalesTaxSummary } from '@/lib/finance/salesTax'
import { getStripeReconciliationReport } from '@/lib/finance/stripeReconciliation'
import { listOwnerTransactions } from '@/lib/finance/ownerTransactions'
import { getForm1099KReconciliationReport } from '@/lib/finance/form1099k'
import { getDataQualityFlags } from '@/lib/finance/dataQualityFlags'
import { buildFinanceExportXLSX, buildFinanceExportCSV, type FinanceSheet, type FinanceExportInput } from '@/lib/export'

function fmtDate(d: Date | string | null): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}
function money(n: number): number {
  return Math.round(n * 100) / 100
}

export async function assembleFinanceExport(range: DateRange): Promise<FinanceExportInput> {
  const taxYear = range.to.getFullYear()
  const [metrics, expenses, discounts, refunds, losses, purchases, vendors, salesTax, ownerTransactions, stripeReconciliation, form1099k, dataQualityFlags] = await Promise.all([
    getFinanceDashboardMetrics(range),
    listExpenses({ from: range.from, to: range.to }),
    getDiscountsCreditsReport(range),
    getRefundReport(range),
    getInventoryLossReport(range),
    listInventoryPurchases({ from: range.from, to: range.to }),
    getVendorReport(range),
    getSalesTaxSummary(range),
    listOwnerTransactions({ from: range.from, to: range.to }),
    getStripeReconciliationReport(range),
    getForm1099KReconciliationReport(taxYear),
    getDataQualityFlags(),
  ])

  const rangeLabel = `${fmtDate(range.from)} to ${fmtDate(range.to)}`

  const summaryRows: (string | number)[][] = [
    ['Gross Revenue (list price)', money(metrics.grossRevenue)],
    ['Discounts & Credits', money(metrics.discountsCredits)],
    ['Net Revenue', money(metrics.netRevenue)],
    ['COGS (known items only)', money(metrics.cogs)],
    ['COGS coverage', `${metrics.cogsCoverage.itemsWithCost} of ${metrics.cogsCoverage.itemsTotal} line items`],
    ['Shipping Expense', money(metrics.shippingExpense)],
    ['Payment Processing Fees', money(metrics.paymentProcessingFees)],
    ['Operating Expenses', money(metrics.operatingExpenses)],
    ['Refunds (completed)', money(metrics.refunds)],
    ['Estimated Gross Margin', money(metrics.estimatedGrossMargin)],
    ['Expenses Needing Accountant Review', metrics.expensesNeedingReview],
    ['', ''],
    ['Note', 'Operational recordkeeping to support bookkeeping/tax prep — not a substitute for a CPA/accountant. Revenue recognized from ISSUED/REFUNDED invoices only.'],
  ]

  const expenseSheet: FinanceSheet = {
    name: 'Expense Ledger',
    headers: ['Date', 'Vendor', 'Description', 'Category', 'Subcategory', 'Amount', 'Payment Method', 'Tax Treatment', 'Invoice #', 'Order #', 'Notes'],
    rows: expenses.map((e) => [fmtDate(e.date), e.vendor ?? '', e.description, e.category, e.subcategory ?? '', money(e.amount), e.paymentMethod ?? '', e.taxTreatment, e.invoiceId ?? '', e.orderId ?? '', e.notes ?? '']),
    colWidths: [12, 20, 32, 26, 18, 10, 16, 22, 14, 14, 30],
  }

  const shippingExpenses = expenses.filter((e) => e.category === 'SHIPPING_POSTAGE')
  const shippingSheet: FinanceSheet = {
    name: 'Shipping',
    headers: ['Date', 'Description', 'Amount', 'Invoice #', 'Order #', 'Notes'],
    rows: shippingExpenses.map((e) => [fmtDate(e.date), e.description, money(e.amount), e.invoiceId ?? '', e.orderId ?? '', e.notes ?? '']),
    colWidths: [12, 32, 10, 14, 14, 30],
  }

  const discountsSheet: FinanceSheet = {
    name: 'Discounts & Credits',
    headers: ['Date', 'Invoice #', 'Customer', 'Label', 'Type', 'Source', 'Applied Amount'],
    rows: discounts.map((d) => [fmtDate(d.issuedAt), d.invoiceNumber, d.customerName, d.label, d.type, d.source, money(d.appliedAmount)]),
    colWidths: [12, 14, 22, 24, 14, 22, 12],
  }

  const inventoryCogsSheet: FinanceSheet = {
    name: 'Inventory - COGS',
    headers: ['Type', 'Date', 'Product', 'Size', 'Quantity', 'Unit Cost / Cost Basis', 'Total', 'Supplier / Reason'],
    rows: [
      ...purchases.map((p) => ['Purchase', fmtDate(p.receivedAt), p.product.name, p.product.size, p.quantity, money(p.unitCost), money(p.totalCost), p.supplier ?? '']),
      ...losses.map((l) => ['Loss/Shrinkage', fmtDate(l.createdAt), l.productName, l.productSize, l.quantity, l.costBasis !== null ? money(l.costBasis / Math.max(l.quantity, 1)) : 'Unknown', l.costBasis !== null ? money(l.costBasis) : 'Unknown', l.reason ?? '']),
    ],
    colWidths: [14, 12, 24, 12, 10, 18, 12, 24],
  }

  const refundsSheet: FinanceSheet = {
    name: 'Refunds',
    headers: ['Completed Date', 'Invoice #', 'Customer', 'Amount', 'Reason'],
    rows: refunds.map((r) => [fmtDate(r.completedAt), r.invoiceNumber, r.customerName, money(r.completedAmount), r.reason]),
    colWidths: [14, 14, 22, 10, 32],
  }

  const vendorsSheet: FinanceSheet = {
    name: 'Vendors',
    headers: ['Vendor', 'Expense Count', 'Total Amount'],
    rows: vendors.map((v) => [v.vendor, v.expenseCount, money(v.totalAmount)]),
    colWidths: [24, 14, 14],
  }

  const needsReviewSheet: FinanceSheet = {
    name: 'Needs Review',
    headers: ['Date', 'Vendor', 'Description', 'Category', 'Amount', 'Notes'],
    rows: expenses.filter((e) => e.taxTreatment === 'NEEDS_ACCOUNTANT_REVIEW').map((e) => [fmtDate(e.date), e.vendor ?? '', e.description, e.category, money(e.amount), e.notes ?? '']),
    colWidths: [12, 20, 32, 26, 10, 30],
  }

  const salesTaxSheet: FinanceSheet = {
    name: 'Sales Tax',
    headers: ['Metric', 'Amount'],
    rows: [
      ['Invoice Taxable Subtotal', money(salesTax.invoiceTaxableSubtotal)],
      ['Invoice Tax Collected', money(salesTax.invoiceTaxCollected)],
      ['Order Taxable Subtotal', money(salesTax.orderTaxableSubtotal)],
      ['Order Tax Collected', money(salesTax.orderTaxCollected)],
      ['Total Tax Collected', money(salesTax.totalTaxCollected)],
      ['Refunded Tax', money(salesTax.refundedTax)],
      ['Net Tax Collected', money(salesTax.netTaxCollected)],
    ],
    colWidths: [28, 14],
  }

  const ownerTransactionsSheet: FinanceSheet = {
    name: 'Owner Transactions',
    headers: ['Date', 'Type', 'Description', 'Amount', 'Source Reference', 'Notes'],
    rows: ownerTransactions.map((t) => [fmtDate(t.date), t.type, t.description, money(t.amount), t.sourceReference ?? '', t.notes ?? '']),
    colWidths: [12, 22, 32, 12, 22, 30],
  }

  const stripeReconciliationSheet: FinanceSheet = {
    name: 'Stripe Reconciliation',
    headers: ['Order #', 'Order Total', 'Stripe Gross', 'Fees', 'Refunded', 'Net Settlement', 'Payout ID', 'Status'],
    rows: stripeReconciliation.map((r) => [r.orderNumber, money(r.orderTotal), money(r.stripeGross), money(r.stripeFees), money(r.refundedAmount), money(r.netSettlement), r.payoutId ?? '', r.status]),
    colWidths: [16, 12, 12, 10, 10, 14, 20, 12],
  }

  const form1099kSheet: FinanceSheet = {
    name: '1099-K Reconciliation',
    headers: ['Metric', 'Amount'],
    rows: [
      ['Tax Year', form1099k.taxYear],
      ['Processor-Reported Gross', form1099k.processorReportedGross !== null ? money(form1099k.processorReportedGross) : 'Not Entered'],
      ['Book Gross', money(form1099k.bookGross)],
      ['Refunds', money(form1099k.refunds)],
      ['Fees', money(form1099k.fees)],
      ['Shipping', money(form1099k.shipping)],
      ['Tax', money(form1099k.tax)],
      ['Adjustments (Discounts)', money(form1099k.adjustments)],
      ['Difference', form1099k.difference !== null ? money(form1099k.difference) : 'N/A'],
    ],
    colWidths: [28, 14],
  }

  const unreconciledItemsSheet: FinanceSheet = {
    name: 'Unreconciled Items',
    headers: ['Type', 'Entity Type', 'Reference', 'Detail'],
    rows: dataQualityFlags.map((f) => [f.type, f.entityType, f.reference, f.detail]),
    colWidths: [30, 14, 20, 40],
  }

  return {
    rangeLabel, summaryRows, expenseSheet, shippingSheet, discountsSheet, inventoryCogsSheet, refundsSheet, vendorsSheet, needsReviewSheet,
    salesTaxSheet, ownerTransactionsSheet, stripeReconciliationSheet, form1099kSheet, unreconciledItemsSheet,
  }
}

export { buildFinanceExportXLSX, buildFinanceExportCSV }
