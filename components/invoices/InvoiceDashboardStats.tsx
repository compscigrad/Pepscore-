// KPI card row for the invoice dashboard. Purely presentational — follows
// the same card pattern as the KPI row in app/admin/page.tsx so the two
// admin dashboards feel like one product.
import { formatCurrency } from '@/lib/orders'
import type { InvoiceDashboardStats as Stats } from '@/lib/invoices'

export function InvoiceDashboardStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Total Invoices', value: String(stats.totalInvoices), sub: 'Active, non-archived', color: 'text-dark' },
    { label: 'Paid', value: String(stats.paidInvoices), sub: 'Fully settled', color: 'text-green-600' },
    { label: 'Partially Paid', value: String(stats.partiallyPaidInvoices), sub: 'Balance remaining', color: 'text-yellow-600' },
    {
      label: 'Outstanding Balance',
      value: formatCurrency(stats.outstandingBalance),
      sub: 'Across all active invoices',
      color: stats.outstandingBalance > 0 ? 'text-amber-600' : 'text-g500',
    },
    { label: 'Pending Shipments', value: String(stats.pendingShipments), sub: 'Preparing or packed', color: stats.pendingShipments > 0 ? 'text-amber-600' : 'text-g500' },
    { label: 'Delivered', value: String(stats.deliveredOrders), sub: 'Confirmed delivered', color: 'text-green-600' },
    { label: 'Revenue', value: formatCurrency(stats.revenue), sub: 'Total across active invoices', color: 'text-gold-dark' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sh">
          <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-2">{card.label}</p>
          <p className={`font-heading text-2xl font-extrabold ${card.color}`}>{card.value}</p>
          <p className="text-[12px] text-g500 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
