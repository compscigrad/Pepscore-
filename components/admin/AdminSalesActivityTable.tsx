// The dashboard's concise, real sales-history table -- sourced from
// Invoice (via lib/adminDashboard.ts's getRecentSalesActivity(), itself
// built on the same listInvoices() service /admin/invoices uses), not the
// empty storefront Order model. Deliberately not a duplicate of the full
// Invoices workspace: no search/sort/pagination here, just the most recent
// rows with a link out to the real thing. Dark PepScore Lab admin theme
// (2026-08-07 migration) -- this table still defines its own badge color
// maps rather than importing components/invoices/StatusBadge.tsx, since
// that component doesn't cover the payment/portal-status variants needed
// here; both now assume the same black-background palette.
import Link from 'next/link'
import { formatCurrency } from '@/lib/orders'
import { formatCarrierLabel } from '@/lib/invoice/format'
import type { SalesActivityRow } from '@/lib/adminDashboard'

const INVOICE_STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-white/5 text-white/50',
  PENDING: 'bg-amber-400/10 text-amber-300',
  ISSUED: 'bg-blue-400/10 text-blue-300',
  CANCELLED: 'bg-red-400/10 text-red-300',
  REFUNDED: 'bg-orange-400/10 text-orange-300',
  VOID: 'bg-white/5 text-white/40',
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  UNPAID: 'bg-white/5 text-white/50',
  PARTIALLY_PAID: 'bg-amber-400/10 text-amber-300',
  PAID: 'bg-green-400/10 text-green-300',
  OVERPAID: 'bg-purple-400/10 text-purple-300',
  REFUNDED: 'bg-orange-400/10 text-orange-300',
}

const DELIVERY_STATUS_STYLE: Record<string, string> = {
  PREPARING: 'bg-white/5 text-white/50',
  PACKED: 'bg-amber-400/10 text-amber-300',
  SHIPPED: 'bg-blue-400/10 text-blue-300',
  IN_TRANSIT: 'bg-purple-400/10 text-purple-300',
  DELIVERED: 'bg-green-400/10 text-green-300',
  RETURNED: 'bg-orange-400/10 text-orange-300',
  LOST: 'bg-red-400/10 text-red-300',
  DAMAGED: 'bg-red-400/10 text-red-300',
}

const PORTAL_STATUS_LABEL: Record<string, string> = {
  NO_CUSTOMER: 'No Customer',
  UNCLAIMED: 'Unclaimed',
  CLAIMED: 'Claimed',
  DISABLED: 'Disabled',
}
const PORTAL_STATUS_STYLE: Record<string, string> = {
  NO_CUSTOMER: 'bg-white/5 text-white/40',
  UNCLAIMED: 'bg-amber-400/10 text-amber-300',
  CLAIMED: 'bg-green-400/10 text-green-300',
  DISABLED: 'bg-red-400/10 text-red-300',
}

function readableLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}

export function AdminSalesActivityTable({ rows, total }: { rows: SalesActivityRow[]; total: number }) {
  return (
    <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
      <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-[17px] font-bold text-white">Sales Activity</h2>
          <p className="text-[12px] text-white/50 mt-0.5">
            {rows.length < total
              ? `Showing the ${rows.length} most recent of ${total} invoices — full history, search, and filters are on the Invoices page.`
              : `All ${total} active invoice${total === 1 ? '' : 's'}.`}
          </p>
        </div>
        <Link href="/admin/invoices" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
          Full Invoice Workspace →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <p className="text-3xl mb-3">🧾</p>
          <p>No invoices yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/10">
                {['Invoice #', 'Date', 'Customer', 'Status', 'Payment', 'Fulfillment', 'Total', 'Balance', 'Tracking', 'Backorder', 'Portal', ''].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className={`text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap ${
                        i === 9 || i === 10 ? 'hidden lg:table-cell' : ''
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ invoice, hasActiveBackorder, portalStatus }) => (
                <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {new Date(invoice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    {invoice.customerId ? (
                      <Link href={`/admin/customers/${invoice.customerId}`} className="font-semibold text-white hover:text-gold-dark hover:underline truncate block">
                        {invoice.customerName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-white truncate block">{invoice.customerName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill label={readableLabel(invoice.status)} className={INVOICE_STATUS_STYLE[invoice.status] ?? 'bg-white/5 text-white/50'} />
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      label={readableLabel(invoice.paymentStatus)}
                      className={PAYMENT_STATUS_STYLE[invoice.paymentStatus] ?? 'bg-white/5 text-white/50'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      label={readableLabel(invoice.deliveryStatus)}
                      className={DELIVERY_STATUS_STYLE[invoice.deliveryStatus] ?? 'bg-white/5 text-white/50'}
                    />
                  </td>
                  <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {invoice.balanceDue > 0 ? (
                      <span className="font-heading font-bold text-amber-300">{formatCurrency(invoice.balanceDue)}</span>
                    ) : (
                      <span className="text-white/30">$0.00</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70 whitespace-nowrap break-all max-w-[160px]">
                    {invoice.carrier ? `${formatCarrierLabel(invoice.carrier)} — ${invoice.trackingNumber ?? 'pending'}` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {hasActiveBackorder ? <Pill label="Active" className="bg-red-400/10 text-red-300" /> : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Pill label={PORTAL_STATUS_LABEL[portalStatus]} className={PORTAL_STATUS_STYLE[portalStatus]} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/invoices/${invoice.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
