// Admin -> Finance (2026-08-12 Finance & Expense Intelligence sprint) --
// the authoritative internal business-expense/financial-operations area.
// Operational recordkeeping and reporting to support bookkeeping/tax prep,
// not a certified accounting platform (spec #16 explicit on this).
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { resolveFinanceRange } from '@/lib/finance/dateRanges'
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
import { getStripeReconciliationReport, getStripeReconciliationSummary } from '@/lib/finance/stripeReconciliation'
import { getProfitLossReport } from '@/lib/finance/profitLoss'
import { getMonthlySummary } from '@/lib/finance/monthlySummary'
import { listOwnerTransactions, getOwnerTransactionSummary } from '@/lib/finance/ownerTransactions'
import { getBusinessTaxProfile, getMissingProfileFields } from '@/lib/finance/taxProfile'
import { listTaxReminders } from '@/lib/finance/taxReminders'
import { listVendors1099WithPayments } from '@/lib/finance/vendors1099'
import { getForm1099KReconciliationReport } from '@/lib/finance/form1099k'
import { getDataQualityFlags } from '@/lib/finance/dataQualityFlags'
import { listMonthlyCloses } from '@/lib/finance/monthlyClose'
import { getEstimatedTaxPlan } from '@/lib/finance/estimatedTax'
import { prisma } from '@/lib/prisma'
import { FinanceView } from '@/components/admin/FinanceView'

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string; open?: string; category?: string; invoiceId?: string }>
}

export default async function FinancePage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/finance')
  if (!(await isCurrentUserAdmin())) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const params = await searchParams
  const range = resolveFinanceRange(params)
  const taxYear = range.to.getFullYear()

  const [
    metrics, expenses, discounts, refunds, losses, purchases, vendors, products,
    salesTax, stripeReconciliation, stripeReconciliationSummary, profitLoss, monthlySummary,
    ownerTransactions, ownerTransactionSummary, taxProfile, taxReminders, vendors1099,
    form1099k, dataQualityFlags, monthlyCloses, estimatedTaxPlan,
  ] = await Promise.all([
    getFinanceDashboardMetrics(range),
    listExpenses({ from: range.from, to: range.to }),
    getDiscountsCreditsReport(range),
    getRefundReport(range),
    getInventoryLossReport(range),
    listInventoryPurchases({ from: range.from, to: range.to }),
    getVendorReport(range),
    prisma.product.findMany({ select: { id: true, name: true, size: true }, orderBy: { name: 'asc' } }),
    getSalesTaxSummary(range),
    getStripeReconciliationReport(range),
    getStripeReconciliationSummary(range),
    getProfitLossReport(range),
    getMonthlySummary(taxYear),
    listOwnerTransactions({ from: range.from, to: range.to }),
    getOwnerTransactionSummary(range),
    getBusinessTaxProfile(),
    listTaxReminders(),
    listVendors1099WithPayments(taxYear),
    getForm1099KReconciliationReport(taxYear),
    getDataQualityFlags(),
    listMonthlyCloses(taxYear),
    getEstimatedTaxPlan(taxYear),
  ])
  const missingProfileFields = getMissingProfileFields(taxProfile)

  return (
    <FinanceView
      range={range}
      taxYear={taxYear}
      metrics={metrics}
      expenses={expenses}
      discounts={discounts}
      refunds={refunds}
      losses={losses}
      purchases={purchases}
      vendors={vendors}
      products={products}
      salesTax={salesTax}
      stripeReconciliation={stripeReconciliation}
      stripeReconciliationSummary={stripeReconciliationSummary}
      profitLoss={profitLoss}
      monthlySummary={monthlySummary}
      ownerTransactions={ownerTransactions}
      ownerTransactionSummary={ownerTransactionSummary}
      taxProfile={taxProfile}
      missingProfileFields={missingProfileFields}
      taxReminders={taxReminders}
      vendors1099={vendors1099}
      form1099k={form1099k}
      dataQualityFlags={dataQualityFlags}
      monthlyCloses={monthlyCloses}
      estimatedTaxPlan={estimatedTaxPlan}
      prefill={params.open === '1' ? { category: params.category, invoiceId: params.invoiceId } : undefined}
    />
  )
}
