// Authoritative production summary for the /admin dashboard's Operations
// section. Deliberately reuses getInvoiceDashboardStats() verbatim (the
// exact same query /admin/invoices uses for its own KPI cards) rather than
// recomputing invoice numbers a second way — the two pages must always
// reconcile by construction, not by coincidence.
//
// Root cause this fixes: /admin previously summarized only the storefront
// Order/Expense tables, which are legitimately empty until the storefront
// launches (see docs/ProductRoadmap.md) -- the page wasn't broken, it was
// summarizing a data source with nothing in it yet, while the actual
// operating business (invoices/customers) lives entirely outside what it
// queried. This adds the missing authoritative summary; it does not remove
// the storefront section, which starts reporting real numbers the moment
// Order rows exist.
import { prisma } from '@/lib/prisma'
import { getInvoiceDashboardStats, round2, type InvoiceDashboardStats } from '@/lib/invoices'

export interface AdminOperationsSummary {
  invoices: InvoiceDashboardStats
  customers: { total: number; claimed: number; unclaimed: number }
  refunds: { pendingCount: number; pendingAmount: number; completedTotal: number }
  credits: { activeCount: number; activeTotal: number }
  backorders: { activeCount: number }
  correspondence: { last7DaysSent: number; last7DaysFailed: number }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function getAdminOperationsSummary(): Promise<AdminOperationsSummary> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const [
    invoices,
    totalCustomers,
    claimedCustomers,
    pendingRefunds,
    completedRefunds,
    activeCredits,
    activeBackorderCount,
    correspondenceSent,
    correspondenceFailed,
  ] = await Promise.all([
    getInvoiceDashboardStats(),
    prisma.customer.count(),
    prisma.customer.count({ where: { userId: { not: null } } }),
    prisma.invoiceRefund.findMany({ where: { status: 'PENDING' }, select: { requestedAmount: true } }),
    prisma.invoiceRefund.aggregate({ where: { status: 'COMPLETED' }, _sum: { completedAmount: true } }),
    prisma.customerAccountCredit.findMany({ where: { remainingAmount: { gt: 0 } }, select: { remainingAmount: true } }),
    prisma.backorderCondition.count({ where: { status: 'ACTIVE' } }),
    prisma.communication.count({ where: { sentAt: { gte: sevenDaysAgo }, status: 'SENT' } }),
    prisma.communication.count({ where: { sentAt: { gte: sevenDaysAgo }, status: 'FAILED' } }),
  ])

  return {
    invoices,
    customers: { total: totalCustomers, claimed: claimedCustomers, unclaimed: totalCustomers - claimedCustomers },
    refunds: {
      pendingCount: pendingRefunds.length,
      pendingAmount: round2(pendingRefunds.reduce((sum, r) => sum + r.requestedAmount, 0)),
      completedTotal: round2(completedRefunds._sum.completedAmount ?? 0),
    },
    credits: {
      activeCount: activeCredits.length,
      activeTotal: round2(activeCredits.reduce((sum, c) => sum + c.remainingAmount, 0)),
    },
    backorders: { activeCount: activeBackorderCount },
    correspondence: { last7DaysSent: correspondenceSent, last7DaysFailed: correspondenceFailed },
  }
}
