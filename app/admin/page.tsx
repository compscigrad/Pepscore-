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
// Access is restricted to the ADMIN_CLERK_USER_ID in .env

export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/orders'
import { isAdminClerkUser } from '@/lib/isAdmin'
import { getAdminOperationsSummary, getRecentSalesActivity, type AdminOperationsSummary } from '@/lib/adminDashboard'
import { getDashboardInventoryAlerts } from '@/lib/adminInventory'
import { AdminOrdersTable } from '@/components/admin/AdminOrdersTable'
import { AdminSalesActivityTable } from '@/components/admin/AdminSalesActivityTable'
import { AdminExportPanel } from '@/components/admin/AdminExportPanel'

async function getStorefrontStats() {
  const now = new Date()
  const startOfYear = new Date(`${now.getFullYear()}-01-01T00:00:00.000Z`)

  const [totalOrders, yearOrders, pendingShipments, yearExpenses] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } }),
    prisma.order.findMany({
      where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfYear } },
      include: { items: true },
    }),
    prisma.order.count({ where: { fulfillmentStatus: 'UNFULFILLED', status: { in: ['PAID', 'PROCESSING'] } } }),
    prisma.expense.findMany({ where: { date: { gte: startOfYear } } }),
  ])

  const yearRevenue = yearOrders.reduce((s, o) => s + o.total, 0)
  const yearCogs = yearExpenses.filter((e) => e.type === 'COGS').reduce((s, e) => s + e.amount, 0)
  const yearShipping = yearExpenses.filter((e) => e.type === 'SHIPPING').reduce((s, e) => s + e.amount, 0)
  const yearStripeFees = yearExpenses.filter((e) => e.type === 'STRIPE_FEE').reduce((s, e) => s + e.amount, 0)
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
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
      <p className="font-heading text-[13px] font-bold text-red-700">{label} failed to load</p>
      <p className="text-[12px] text-red-600 mt-1">{error}</p>
      <p className="text-[12px] text-red-600 mt-1">Check server logs for the full stack trace — this section was not silently skipped.</p>
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
  if (!isAdminClerkUser(userId)) {
    return (
      <main className="min-h-screen bg-g100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sh p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-dark mb-2">Access Denied</h1>
          <p className="text-g500 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const [operations, salesActivity, storefront, inventoryAlerts, recentOrdersResult] = await Promise.all([
    loadSection('Operations Summary', getAdminOperationsSummary),
    loadSection('Sales Activity', getRecentSalesActivity),
    loadSection('Storefront Stats', getStorefrontStats),
    loadSection('Inventory Alerts', getDashboardInventoryAlerts),
    loadSection('Recent Orders', () =>
      prisma.order.findMany({
        include: {
          items: true,
          invoice: { select: { invoiceNumber: true } },
          shippingLabel: { select: { trackingNumber: true, carrier: true, labelUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    ),
  ])

  return (
    <main className="min-h-screen bg-g100 p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-dark">Pepscore Admin</h1>
            <p className="text-g500 text-sm mt-1">Owner dashboard</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Link href="/admin/invoices" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
              Invoices →
            </Link>
            <Link href="/admin/intake-queue" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
              Intake Queue
            </Link>
            <Link href="/admin/inventory" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
              Inventory
            </Link>
            <Link href="/admin/identity-review" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
              Identity Review
            </Link>
            <Link href="/" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
              ← Storefront
            </Link>
          </div>
        </div>

        {/* ── Operations Summary (the real, currently-operating business) ──── */}
        <h2 className="font-heading text-[15px] font-bold text-dark mb-3">Operations Summary</h2>
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
            <div className="bg-white rounded-2xl shadow-sh p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-5 flex-wrap text-[13px]">
                {inventoryAlerts.data.outOfStockCount > 0 && (
                  <span className="font-heading font-bold text-red-600">{inventoryAlerts.data.outOfStockCount} out of stock</span>
                )}
                {inventoryAlerts.data.openLowStockAlerts > 0 && (
                  <span className="font-heading font-bold text-orange-700">{inventoryAlerts.data.openLowStockAlerts} low-stock alert{inventoryAlerts.data.openLowStockAlerts === 1 ? '' : 's'}</span>
                )}
                {inventoryAlerts.data.awaitingInitializationCount > 0 && (
                  <span className="font-heading font-bold text-amber-700">{inventoryAlerts.data.awaitingInitializationCount} awaiting inventory initialization</span>
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
        <h2 className="font-heading text-[15px] font-bold text-dark mb-3">Storefront{storefront.ok && storefront.data.totalOrders === 0 ? ' (not yet launched — 0 orders on file)' : ''}</h2>
        {storefront.ok ? (
          <StorefrontSection stats={storefront.data} />
        ) : (
          <ErrorCard label="Storefront Stats" error={storefront.error} />
        )}

        <div className="bg-white rounded-2xl shadow-sh mb-8 overflow-hidden">
          <div className="p-6 border-b border-g100">
            <h2 className="font-heading text-[17px] font-bold text-dark">Storefront Orders</h2>
            <p className="text-[12px] text-g500 mt-0.5">Online storefront checkouts only — see Sales Activity above for invoices.</p>
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
          { label: 'Revenue (active + archived)', value: formatCurrency(invoices.revenue), sub: `${invoices.totalInvoices} active invoices`, color: 'text-green-600' },
          { label: 'Outstanding Balance', value: formatCurrency(invoices.outstandingBalance), sub: `${invoices.paidInvoices} paid, ${invoices.partiallyPaidInvoices} partial`, color: 'text-amber-600' },
          { label: 'Pending Shipments', value: String(invoices.pendingShipments), sub: `${invoices.deliveredOrders} delivered`, color: invoices.pendingShipments > 0 ? 'text-amber-600' : 'text-g500' },
          { label: 'Customers', value: String(customers.total), sub: `${customers.claimed} claimed · ${customers.unclaimed} unclaimed`, color: 'text-blue-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sh">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-2">{card.label}</p>
            <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-[12px] text-g500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Refunds', value: `${refunds.pendingCount} (${formatCurrency(refunds.pendingAmount)})`, sub: `${formatCurrency(refunds.completedTotal)} completed all-time` },
          { label: 'Active Account Credits', value: String(credits.activeCount), sub: `${formatCurrency(credits.activeTotal)} outstanding` },
          { label: 'Active Backorders', value: String(backorders.activeCount), sub: 'Awaiting resolution' },
          { label: 'Correspondence (7d)', value: `${correspondence.last7DaysSent} sent`, sub: `${correspondence.last7DaysFailed} failed`, color: correspondence.last7DaysFailed > 0 ? 'text-red-600' : 'text-g500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sh">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-2">{card.label}</p>
            <p className={`font-heading text-xl font-extrabold ${card.color ?? 'text-dark'}`}>{card.value}</p>
            <p className="text-[12px] text-g500 mt-1">{card.sub}</p>
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
          { label: 'YTD Revenue', value: formatCurrency(stats.yearRevenue), sub: `${stats.totalOrders} total orders`, color: 'text-green-600' },
          { label: 'YTD Gross Profit', value: formatCurrency(stats.yearGrossProfit), sub: `After COGS (${formatCurrency(stats.yearCogs)})`, color: 'text-blue-600' },
          { label: 'YTD Net Profit', value: formatCurrency(stats.yearNetProfit), sub: 'After all expenses', color: 'text-gold-dark' },
          { label: 'Pending Shipments', value: String(stats.pendingShipments), sub: 'Awaiting label creation', color: stats.pendingShipments > 0 ? 'text-amber-600' : 'text-g500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sh">
            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-2">{card.label}</p>
            <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-[12px] text-g500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sh mb-8">
        <h3 className="font-heading text-[15px] font-bold text-dark mb-4">{stats.year} Expense Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Cost of Goods', amount: stats.yearCogs },
            { label: 'Shipping Labels', amount: stats.yearShipping },
            { label: 'Stripe Fees', amount: stats.yearStripeFees },
          ].map((e) => (
            <div key={e.label} className="bg-g100 rounded-xl p-4">
              <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">{e.label}</p>
              <p className="font-heading text-xl font-bold text-dark">{formatCurrency(e.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
