// Admin -> Finance (2026-08-12 Finance & Expense Intelligence sprint) --
// the authoritative internal business-expense/financial-operations area.
// Operational recordkeeping and reporting to support bookkeeping/tax prep,
// not a certified accounting platform (spec #16 explicit on this).
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isAdminClerkUser } from '@/lib/isAdmin'
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
import { prisma } from '@/lib/prisma'
import { FinanceView } from '@/components/admin/FinanceView'

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string; open?: string; category?: string; invoiceId?: string }>
}

export default async function FinancePage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/finance')
  if (!isAdminClerkUser(userId)) {
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

  const [metrics, expenses, discounts, refunds, losses, purchases, vendors, products] = await Promise.all([
    getFinanceDashboardMetrics(range),
    listExpenses({ from: range.from, to: range.to }),
    getDiscountsCreditsReport(range),
    getRefundReport(range),
    getInventoryLossReport(range),
    listInventoryPurchases({ from: range.from, to: range.to }),
    getVendorReport(range),
    prisma.product.findMany({ select: { id: true, name: true, size: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <FinanceView
      range={range}
      metrics={metrics}
      expenses={expenses}
      discounts={discounts}
      refunds={refunds}
      losses={losses}
      purchases={purchases}
      vendors={vendors}
      products={products}
      prefill={params.open === '1' ? { category: params.category, invoiceId: params.invoiceId } : undefined}
    />
  )
}
