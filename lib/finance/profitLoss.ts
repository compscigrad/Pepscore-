// Internal Profit & Loss report (2026-08-18 Finance Center sprint).
// Structures the existing getFinanceDashboardMetrics()/
// getOwnerTransactionSummary() figures into the conventional
// Revenue -> Net Revenue -> Gross Profit -> Operating Profit hierarchy --
// no new aggregation, no second copy of any money calculation (spec #33:
// "avoid duplicating money calculations across multiple components").
// Sales tax collected is deliberately excluded from Revenue (it was never
// the business's money) and shown as its own pass-through line, per the
// spec's explicit revenue-distinction requirement.
import { getFinanceDashboardMetrics, type DateRange } from './reports'
import { getSalesTaxSummary } from './salesTax'

export interface ProfitLossReport {
  range: DateRange
  isInternalManagementReport: true // always true -- a compile-time-visible reminder this is never a filed return
  revenue: {
    productSales: number
    shippingRevenue: number // always 0 today -- see docs/launch/CheckoutShippingOptions.md
    otherRevenue: number
    lessDiscounts: number
    lessRefunds: number
    netRevenue: number
  }
  salesTaxCollected: number // pass-through liability, not revenue -- shown for visibility only, never added into any total above
  cogs: {
    productCost: number
    packagingAllocation: number // always 0 -- no packaging-allocation mechanism exists yet (spec explicitly scopes this out: "do not overbuild full manufacturing accounting")
    total: number
    coverage: { itemsWithCost: number; itemsTotal: number }
  }
  grossProfit: number
  operatingExpenses: {
    shipping: number
    paymentProcessing: number
    other: number
    total: number
  }
  operatingProfit: number
}

export async function getProfitLossReport(range: DateRange): Promise<ProfitLossReport> {
  const [metrics, salesTax] = await Promise.all([getFinanceDashboardMetrics(range), getSalesTaxSummary(range)])

  const productSales = metrics.grossRevenue
  const shippingRevenue = 0
  const otherRevenue = 0
  const lessDiscounts = metrics.discountsCredits
  const lessRefunds = metrics.refunds
  const netRevenue = productSales + shippingRevenue + otherRevenue - lessDiscounts - lessRefunds

  const cogsTotal = metrics.cogs
  const grossProfit = netRevenue - cogsTotal

  // "Other" opex = every operating expense not already broken out above,
  // i.e. total operating expenses minus the shipping/payment-processing
  // slices reports.ts already isolates -- never double-counted.
  const otherOpex = Math.max(0, metrics.operatingExpenses - metrics.shippingExpense - metrics.paymentProcessingFees)
  const operatingExpensesTotal = metrics.shippingExpense + metrics.paymentProcessingFees + otherOpex
  const operatingProfit = grossProfit - operatingExpensesTotal

  return {
    range,
    isInternalManagementReport: true,
    revenue: {
      productSales,
      shippingRevenue,
      otherRevenue,
      lessDiscounts,
      lessRefunds,
      netRevenue,
    },
    salesTaxCollected: salesTax.totalTaxCollected,
    cogs: {
      productCost: cogsTotal,
      packagingAllocation: 0,
      total: cogsTotal,
      coverage: metrics.cogsCoverage,
    },
    grossProfit,
    operatingExpenses: {
      shipping: metrics.shippingExpense,
      paymentProcessing: metrics.paymentProcessingFees,
      other: otherOpex,
      total: operatingExpensesTotal,
    },
    operatingProfit,
  }
}
