// Owner/Admin dashboard. Independent sections, each fetched and error-
// handled separately so a failure in one never blanks out the others:
//   - Operations Summary: KPI cards (lib/adminDashboard.ts's
//     getAdminOperationsSummary()) -- reuses the exact same
//     getInvoiceDashboardStats() query /admin/invoices renders its own KPI
//     cards from, so the two pages always reconcile by construction.
//   - Sales Activity: the actual recent transaction rows -- Invoice-sourced
//     (getRecentSalesActivity(), built on the same listInvoices() service
//     /admin/invoices uses), because Pepscore's real sales history lives in
//     Invoice today. This replaced an "All Orders" table that queried the
//     storefront Order model directly and was therefore always empty (Order
//     has zero rows until the storefront launches) -- that was the root
//     cause of the dashboard looking empty despite real production data
//     existing. Order-sourced rows join this same view once real ones exist
//     (see lib/adminDashboard.ts's header comment on that model).
//   - Storefront: Order/Expense-based KPIs + the raw storefront order table
//     (AdminOrdersTable), legitimately all-zero until the storefront
//     launches (see docs/ProductRoadmap.md) -- not a bug, a different,
//     not-yet-populated data source, kept visually and semantically
//     separate from Sales Activity above so the two "orders"-ish tables are
//     never confused for each other.
// Access is restricted to the database-backed ADMIN role (lib/auth/rbac.ts)

export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/orders'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { getAdminOperationsSummary, getRecentSalesActivity, type AdminOperationsSummary } from '@/lib/adminDashboard'
import { getDashboardInventoryAlerts } from '@/lib/adminInventory'
import { listOpenFulfillmentAlerts } from '@/lib/fulfillment/alerts'
import { AdminOrdersTable } from '@/components/admin/AdminOrdersTable'
import { AdminSalesActivityTable } from '@/components/admin/AdminSalesActivityTable'
import { AdminExportPanel } from '@/components/admin/AdminExportPanel'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

async function getStorefrontStats() {
  const now = new Date()
  const startOfYear = new Date(`${now.getFullYear()}-01-01T00:00:00.000Z`)

  // Summed/grouped in the database rather than fetching every order (with
  // its full item rows, unused here) and every expense row and reducing in
  // JS -- this ran on every admin dashboard load and grows unbounded with
  // total order/expense volume once the storefront launches.
  const [totalOrders, yearRevenueAgg, pendingShipments, yearExpensesByType] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfYear } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { fulfillmentStatus: 'UNFULFILLED', status: { in: ['PAID', 'PROCESSING'] } } }),
    prisma.expense.groupBy({ by: ['type'], where: { date: { gte: startOfYear } }, _sum: { amount: true } }),
  ])

  const sumByType = (type: string) => yearExpensesByType.find((e) => e.type === type)?._sum.amount ?? 0
  const yearRevenue = yearRevenueAgg._sum.total ?? 0
  const yearCogs = sumByType('COGS')
  const yearShipping = sumByType('SHIPPING')
  const yearStripeFees = sumByType('STRIPE_FEE')
  const yearGrossProfit = yearRevenue - yearCogs
  const yearNetProfit = yearGrossProfit - yearShipping - yearStripeFees

  return { totalOrders, pendingShipments, yearRevenue, yearCogs, yearShipping, yearStripeFees, yearGrossProfit, yearNetProfit, year: now.getFullYear() }
}

type SectionResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function loadSection<T>(label: string, fn: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    // Structured, server-side only -- never swallowed. The admin sees a
    // plain "failed to load" card (ErrorCard below); this is what an
    // operator/log search actually needs to diagnose it.
    console.error(`[admin/dashboard] Failed to load section "${label}":`, err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

function ErrorCard({ label, error }: { label: string; error: string }) {
  return (
    <div className="bg-red-400/10 border border-red-400/25 rounded-2xl p-6 mb-8">
      <p className="font-heading text-[13px] font-bold text-red-300">{label} failed to load</p>
      <p className="text-[12px] text-red-300/80 mt-1">{error}</p>
      <p className="text-[12px] text-red-300/80 mt-1">Check server logs for the full stack trace — this section was not silently skipped.</p>
    </div>
  )
}

export default async function AdminDashboard() {
  const { userId } = await auth()
  // Not signed in at all -- send to sign-in with an explicit redirect_url
  // so they land back here (not /account) once authenticated.
  if (!userId) redirect('/sign-in?redirect_url=/admin')
  // Signed in, but not the admin -- a clear, explicit access-denied
  // response, never a silent bounce to the storefront that leaves someone
  // wondering what just happened.
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

  const [operations, salesActivity, storefront, inventoryAlerts, fulfillmentAlerts, recentOrdersResult] = await Promise.all([
    loadSection('Operations Summary', getAdminOperationsSummary),
    loadSection('Sales Activity', getRecentSalesActivity),
    loadSection('Storefront Stats', getStorefrontStats),
    loadSection('Inventory Alerts', getDashboardInventoryAlerts),
    loadSection('Fulfillment Alerts', listOpenFulfillmentAlerts),
    loadSection('Recent Orders', () =>
      prisma.order.findMany({
        include: {
          items: true,
          invoice: { select: { invoiceNumber: true } },
          shippingLabel: { select: { trackingNumber: true, carrier: true, labelUrl: true } },
          payments: { select: { amount: true, stripeFee: true, status: true, provider: true, methodType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    ),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* 2026-08-12 admin IA consolidation: this row used to hand-roll its
            own Invoices/Orders/Customers/Intake/Inventory/Identity Review/
            Storefront links -- every one of them now lives in the shared
            AdminNav (app/admin/layout.tsx), reachable from every admin page,
            so repeating them here was pure redundancy, not a second real
            navigation path. */}
        {/* 2026-08-19: the sticky AdminNav already carries the full
            PEPSCORE/LAB + ADMIN brand lockup immediately above this page --
            repeating "Pepscore Lab Admin" here was pure redundancy directly
            under the branded header. "Administration" is the actual
            page-level heading now; "Owner Dashboard" remains the subtitle. */}
        <AdminPageHeader title="Administration" subtitle="Owner Dashboard" />

        {/* ── Needs Attention (2026-08-13 Fulfillment Command Center) --
             concise, cross-cutting operational risk only, not a repeat of
             the full fulfillment queue (that's /admin/fulfillment) -- shows
             nothing when there's nothing open. ── */}
        {fulfillmentAlerts.ok && fulfillmentAlerts.data.length > 0 && (
          <div className="bg-red-400/[0.06] border border-red-400/20 rounded-[18px] p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-[15px] font-bold text-red-300">
                Needs Attention · {fulfillmentAlerts.data.length} fulfillment alert{fulfillmentAlerts.data.length === 1 ? '' : 's'}
              </h2>
              <Link href="/admin/fulfillment" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                Fulfillment Command Center →
              </Link>
            </div>
            <div className="space-y-2">
              {fulfillmentAlerts.data.slice(0, 5).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/admin/invoices/${alert.invoiceId}`}
                  className="flex items-center justify-between gap-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] transition-colors"
                >
                  <span className="text-white/80 truncate">{alert.message}</span>
                  <span className="text-white/40 text-[11px] font-heading font-bold uppercase tracking-[0.06em] whitespace-nowrap">{alert.bucketLabel}</span>
                </Link>
              ))}
              {fulfillmentAlerts.data.length > 5 && (
                <p className="text-[12px] text-white/40 pt-1">+{fulfillmentAlerts.data.length - 5} more — see Fulfillment Command Center.</p>
              )}
            </div>
          </div>
        )}
        {!fulfillmentAlerts.ok && <ErrorCard label="Fulfillment Alerts" error={fulfillmentAlerts.error} />}

        {/* ── Operations Summary (the real, currently-operating business) ──── */}
        <h2 className="font-heading text-[15px] font-bold text-white mb-3">Operations Summary</h2>
        {operations.ok ? (
          <OperationsSummarySection data={operations.data} />
        ) : (
          <ErrorCard label="Operations Summary" error={operations.error} />
        )}

        {/* ── Inventory Alerts (only rendered when there's something to see —
             a healthy catalog with zero alerts shows nothing here rather than
             an empty banner) ── */}
        {inventoryAlerts.ok &&
          (inventoryAlerts.data.openLowStockAlerts > 0 ||
            inventoryAlerts.data.awaitingInitializationCount > 0 ||
            inventoryAlerts.data.outOfStockCount > 0) && (
            <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-5 flex-wrap text-[13px]">
                {inventoryAlerts.data.outOfStockCount > 0 && (
                  <span className="font-heading font-bold text-red-400">{inventoryAlerts.data.outOfStockCount} out of stock</span>
                )}
                {inventoryAlerts.data.openLowStockAlerts > 0 && (
                  <span className="font-heading font-bold text-orange-400">{inventoryAlerts.data.openLowStockAlerts} low-stock alert{inventoryAlerts.data.openLowStockAlerts === 1 ? '' : 's'}</span>
                )}
                {inventoryAlerts.data.awaitingInitializationCount > 0 && (
                  <span className="font-heading font-bold text-amber-400">{inventoryAlerts.data.awaitingInitializationCount} awaiting inventory initialization</span>
                )}
              </div>
              <Link href="/admin/inventory" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                Manage Inventory →
              </Link>
            </div>
          )}

        {/* ── Sales Activity (Invoice-sourced -- the real, populated sales
             history today; Order-sourced storefront rows will join this same
             view once the storefront launches, see lib/adminDashboard.ts) ── */}
        <div className="mb-8">
          {salesActivity.ok ? (
            <AdminSalesActivityTable rows={salesActivity.data.rows} total={salesActivity.data.total} />
          ) : (
            <ErrorCard label="Sales Activity" error={salesActivity.error} />
          )}
        </div>

        {/* ── Storefront (Order/Expense-based -- empty until launch) ───────── */}
        <h2 className="font-heading text-[15px] font-bold text-white mb-3">Storefront{storefront.ok && storefront.data.totalOrders === 0 ? ' (not yet launched — 0 orders on file)' : ''}</h2>
        {storefront.ok ? (
          <StorefrontSection stats={storefront.data} />
        ) : (
          <ErrorCard label="Storefront Stats" error={storefront.error} />
        )}

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] mb-8 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="font-heading text-[17px] font-bold text-white">Storefront Orders</h2>
            <p className="text-[12px] text-white/50 mt-0.5">Online storefront checkouts only — see Sales Activity above for invoices.</p>
          </div>
          {recentOrdersResult.ok ? (
            <AdminOrdersTable orders={recentOrdersResult.data} />
          ) : (
            <div className="p-6">
              <ErrorCard label="Recent Orders" error={recentOrdersResult.error} />
            </div>
          )}
        </div>

        {storefront.ok && <AdminExportPanel currentYear={storefront.data.year} />}
      </div>
    </main>
  )
}

function OperationsSummarySection({ data }: { data: AdminOperationsSummary }) {
  const { invoices, customers, refunds, credits, backorders, correspondence } = data
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Revenue (active + archived)', value: formatCurrency(invoices.revenue), sub: `${invoices.totalInvoices} active invoices`, color: 'text-green-400' },
          { label: 'Outstanding Balance', value: formatCurrency(invoices.outstandingBalance), sub: `${invoices.paidInvoices} paid, ${invoices.partiallyPaidInvoices} partial`, color: 'text-amber-400' },
          { label: 'Pending Shipments', value: String(invoices.pendingShipments), sub: `${invoices.deliveredOrders} delivered`, color: invoices.pendingShipments > 0 ? 'text-amber-400' : 'text-white/50' },
          { label: 'Customers', value: String(customers.total), sub: `${customers.claimed} claimed · ${customers.unclaimed} unclaimed`, color: 'text-blue-400' },
        ].map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-2">{card.label}</p>
            <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-[12px] text-white/50 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-white/40 -mt-2 mb-8">
        Revenue here totals all non-cancelled invoices, including unpaid pending/draft ones — for revenue recognized on issued/paid invoices only, see{' '}
        <a href="/admin/finance" className="text-gold/70 hover:text-gold underline">Finance → P&amp;L / Sales Tax</a>.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Refunds', value: `${refunds.pendingCount} (${formatCurrency(refunds.pendingAmount)})`, sub: `${formatCurrency(refunds.completedTotal)} completed all-time` },
          { label: 'Active Account Credits', value: String(credits.activeCount), sub: `${formatCurrency(credits.activeTotal)} outstanding` },
          { label: 'Active Backorders', value: String(backorders.activeCount), sub: 'Awaiting resolution' },
          { label: 'Correspondence (7d)', value: `${correspondence.last7DaysSent} sent`, sub: `${correspondence.last7DaysFailed} failed`, color: correspondence.last7DaysFailed > 0 ? 'text-red-400' : 'text-white/50' },
        ].map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-2">{card.label}</p>
            <p className={`font-heading text-xl font-extrabold ${card.color ?? 'text-white'}`}>{card.value}</p>
            <p className="text-[12px] text-white/50 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
    </>
  )
}

function StorefrontSection({ stats }: { stats: Awaited<ReturnType<typeof getStorefrontStats>> }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'YTD Revenue', value: formatCurrency(stats.yearRevenue), sub: `${stats.totalOrders} total orders`, color: 'text-green-400' },
          { label: 'YTD Gross Profit', value: formatCurrency(stats.yearGrossProfit), sub: `After COGS (${formatCurrency(stats.yearCogs)})`, color: 'text-blue-400' },
          { label: 'YTD Net Profit', value: formatCurrency(stats.yearNetProfit), sub: 'After all expenses', color: 'text-gold' },
          { label: 'Pending Shipments', value: String(stats.pendingShipments), sub: 'Awaiting label creation', color: stats.pendingShipments > 0 ? 'text-amber-400' : 'text-white/50' },
        ].map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-2">{card.label}</p>
            <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-[12px] text-white/50 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6 mb-8">
        <h3 className="font-heading text-[15px] font-bold text-white mb-4">{stats.year} Expense Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Cost of Goods', amount: stats.yearCogs },
            { label: 'Shipping Labels', amount: stats.yearShipping },
            { label: 'Stripe Fees', amount: stats.yearStripeFees },
          ].map((e) => (
            <div key={e.label} className="bg-white/5 rounded-xl p-4">
              <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-1">{e.label}</p>
              <p className="font-heading text-xl font-bold text-white">{formatCurrency(e.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
