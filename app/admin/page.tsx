// Owner/Admin dashboard — orders, profit metrics, shipping, and CPA export
// Access is restricted to the ADMIN_CLERK_USER_ID in .env

export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/orders'
import { AdminOrdersTable } from '@/components/admin/AdminOrdersTable'
import { AdminExportPanel } from '@/components/admin/AdminExportPanel'

async function getAdminStats() {
  const now = new Date()
  const startOfYear = new Date(`${now.getFullYear()}-01-01T00:00:00.000Z`)

  const [
    totalOrders,
    yearOrders,
    pendingShipments,
    yearExpenses,
  ] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID','PROCESSING','SHIPPED','DELIVERED'] } } }),
    prisma.order.findMany({
      where: {
        status: { in: ['PAID','PROCESSING','SHIPPED','DELIVERED'] },
        createdAt: { gte: startOfYear },
      },
      include: { items: true },
    }),
    prisma.order.count({ where: { fulfillmentStatus: 'UNFULFILLED', status: { in: ['PAID','PROCESSING'] } } }),
    prisma.expense.findMany({ where: { date: { gte: startOfYear } } }),
  ])

  const yearRevenue = yearOrders.reduce((s, o) => s + o.total, 0)
  const yearCogs = yearExpenses.filter(e => e.type === 'COGS').reduce((s, e) => s + e.amount, 0)
  const yearShipping = yearExpenses.filter(e => e.type === 'SHIPPING').reduce((s, e) => s + e.amount, 0)
  const yearStripeFees = yearExpenses.filter(e => e.type === 'STRIPE_FEE').reduce((s, e) => s + e.amount, 0)
  const yearGrossProfit = yearRevenue - yearCogs
  const yearNetProfit = yearGrossProfit - yearShipping - yearStripeFees

  return {
    totalOrders,
    pendingShipments,
    yearRevenue,
    yearCogs,
    yearShipping,
    yearStripeFees,
    yearGrossProfit,
    yearNetProfit,
    year: now.getFullYear(),
  }
}

export default async function AdminDashboard() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const stats = await getAdminStats()

  const recentOrders = await prisma.order.findMany({
    include: {
      items: true,
      invoice: { select: { invoiceNumber: true } },
      shippingLabel: { select: { trackingNumber: true, carrier: true, labelUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <main className="min-h-screen bg-g100 p-8">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-dark">Pepscore Admin</h1>
            <p className="text-g500 text-sm mt-1">Owner dashboard · {stats.year} YTD</p>
          </div>
          <a href="/" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors">
            ← Storefront
          </a>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'YTD Revenue', value: formatCurrency(stats.yearRevenue), sub: `${stats.totalOrders} total orders`, color: 'text-green-600' },
            { label: 'YTD Gross Profit', value: formatCurrency(stats.yearGrossProfit), sub: `After COGS (${formatCurrency(stats.yearCogs)})`, color: 'text-blue-600' },
            { label: 'YTD Net Profit', value: formatCurrency(stats.yearNetProfit), sub: `After all expenses`, color: 'text-gold-dark' },
            { label: 'Pending Shipments', value: String(stats.pendingShipments), sub: 'Awaiting label creation', color: stats.pendingShipments > 0 ? 'text-amber-600' : 'text-g500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sh">
              <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-2">{card.label}</p>
              <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
              <p className="text-[12px] text-g500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Expense Breakdown ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sh mb-8">
          <h2 className="font-heading text-[15px] font-bold text-dark mb-4">{stats.year} Expense Breakdown</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Cost of Goods', amount: stats.yearCogs },
              { label: 'Shipping Labels', amount: stats.yearShipping },
              { label: 'Stripe Fees', amount: stats.yearStripeFees },
            ].map(e => (
              <div key={e.label} className="bg-g100 rounded-xl p-4">
                <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">{e.label}</p>
                <p className="font-heading text-xl font-bold text-dark">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Orders Table ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sh mb-8 overflow-hidden">
          <div className="p-6 border-b border-g100">
            <h2 className="font-heading text-[17px] font-bold text-dark">All Orders</h2>
          </div>
          <AdminOrdersTable orders={recentOrders} />
        </div>

        {/* ── CPA Export ───────────────────────────────────────────────────── */}
        <AdminExportPanel currentYear={stats.year} />
      </div>
    </main>
  )
}
