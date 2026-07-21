// KPI card row for the invoice dashboard. Purely presentational — uses the
// same glass-card treatment (theme.ts) as every other panel in this section.
import { formatCurrency } from '@/lib/orders'
import { card } from './theme'
import type { InvoiceDashboardStats as Stats } from '@/lib/invoices'

export function InvoiceDashboardStats({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Total Invoices', value: String(stats.totalInvoices), sub: 'Active, non-archived', color: 'text-white' },
    { label: 'Paid', value: String(stats.paidInvoices), sub: 'Fully settled', color: 'text-green-400' },
    { label: 'Partially Paid', value: String(stats.partiallyPaidInvoices), sub: 'Balance remaining', color: 'text-amber-300' },
    {
      label: 'Outstanding Balance',
      value: formatCurrency(stats.outstandingBalance),
      sub: 'Across all active invoices',
      color: stats.outstandingBalance > 0 ? 'text-amber-300' : 'text-white/40',
    },
    { label: 'Pending Shipments', value: String(stats.pendingShipments), sub: 'Preparing or packed', color: stats.pendingShipments > 0 ? 'text-amber-300' : 'text-white/40' },
    { label: 'Delivered', value: String(stats.deliveredOrders), sub: 'Confirmed delivered', color: 'text-green-400' },
    { label: 'Revenue', value: formatCurrency(stats.revenue), sub: 'Total across active invoices', color: 'text-gold-light' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((stat) => (
        <div key={stat.label} className={`${card} p-5`}>
          <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-2">{stat.label}</p>
          <p className={`font-heading text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
          <p className="text-[12px] text-white/40 mt-1">{stat.sub}</p>
        </div>
      ))}
    </div>
  )
}
