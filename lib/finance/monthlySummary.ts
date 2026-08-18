// Month-by-month financial summary (2026-08-18 Finance Center sprint).
// Runs the same getFinanceDashboardMetrics() the dashboard/P&L use, once
// per calendar month -- twelve small queries rather than one clever
// GROUP BY, matching this codebase's preference for reusing an existing,
// already-correct aggregation over a parallel implementation that could
// drift from it.
import { prisma } from '@/lib/prisma'
import { getFinanceDashboardMetrics, RECOGNIZED_REVENUE_STATUSES } from './reports'

export interface MonthlySummaryRow {
  year: number
  month: number // 1-12
  monthLabel: string
  grossRevenue: number
  netRevenue: number
  cogs: number
  operatingExpenses: number
  paymentProcessingFees: number
  shippingExpense: number
  refunds: number
  estimatedGrossMargin: number
  invoiceCount: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function getMonthlySummary(year: number): Promise<MonthlySummaryRow[]> {
  const months = Array.from({ length: 12 }, (_, i) => i) // 0-11
  const rows = await Promise.all(
    months.map(async (m) => {
      const from = new Date(year, m, 1, 0, 0, 0, 0)
      const to = new Date(year, m + 1, 0, 23, 59, 59, 999)
      const [metrics, invoiceCount] = await Promise.all([
        getFinanceDashboardMetrics({ from, to }),
        prisma.invoice.count({ where: { issuedAt: { gte: from, lte: to }, status: { in: RECOGNIZED_REVENUE_STATUSES }, isTestData: false } }),
      ])
      return {
        year,
        month: m + 1,
        monthLabel: MONTH_LABELS[m],
        grossRevenue: metrics.grossRevenue,
        netRevenue: metrics.netRevenue,
        cogs: metrics.cogs,
        operatingExpenses: metrics.operatingExpenses,
        paymentProcessingFees: metrics.paymentProcessingFees,
        shippingExpense: metrics.shippingExpense,
        refunds: metrics.refunds,
        estimatedGrossMargin: metrics.estimatedGrossMargin,
        invoiceCount,
      }
    })
  )
  return rows
}
