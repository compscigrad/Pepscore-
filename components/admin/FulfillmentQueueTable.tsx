// Fulfillment Command Center queue table. Oldest-first (already sorted by
// listFulfillmentQueue()'s paidAt asc), color-coded by urgency but
// deliberately sparing with red -- only LABEL_NEEDED/STALLED/EXCEPTION (the
// three ACTIONABLE_BUCKETS) get it; healthy in-progress states stay neutral
// or green so a real problem doesn't get lost in a page full of color.
import Link from 'next/link'
import { formatCurrency } from '@/lib/orders'
import { BUCKET_LABEL, type FulfillmentBucket, type FulfillmentQueueRow } from '@/lib/fulfillment/commandCenter'

const BUCKET_STYLE: Record<FulfillmentBucket, string> = {
  NOT_APPLICABLE: 'bg-white/5 text-white/40',
  NEEDS_FULFILLMENT: 'bg-white/5 text-white/70',
  LABEL_NEEDED: 'bg-red-400/10 text-red-300',
  AWAITING_CARRIER_SCAN: 'bg-amber-400/10 text-amber-300',
  IN_TRANSIT: 'bg-green-400/10 text-green-300',
  STALLED: 'bg-red-400/10 text-red-300',
  EXCEPTION: 'bg-purple-400/10 text-purple-300',
  DELIVERED: 'bg-green-400/10 text-green-300',
  SELF_DELIVERY: 'bg-blue-400/10 text-blue-300',
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}

function formatAge(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return '<1h'
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

export function FulfillmentQueueTable({ rows }: { rows: FulfillmentQueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-white/50">
        <p className="text-3xl mb-3">📦</p>
        <p>Nothing in the fulfillment queue — every paid order is either delivered or not yet due for tracking.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/10">
            {['Order', 'Customer', 'Status', 'Age', 'Backorder', 'Balance', 'Total', ''].map((h) => (
              <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.invoiceId} className="border-b border-white/10 hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{row.invoiceNumber}</td>
              <td className="px-4 py-3 max-w-[180px]">
                {row.customerId ? (
                  <Link href={`/admin/customers/${row.customerId}`} className="font-semibold text-white hover:text-gold-dark hover:underline truncate block">
                    {row.customerName}
                  </Link>
                ) : (
                  <span className="font-semibold text-white truncate block">{row.customerName}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Pill label={BUCKET_LABEL[row.bucket]} className={BUCKET_STYLE[row.bucket]} />
              </td>
              <td className="px-4 py-3 text-white/70 whitespace-nowrap">{formatAge(row.ageHours)}</td>
              <td className="px-4 py-3">
                {row.hasActiveBackorder ? <Pill label="Backordered" className="bg-orange-400/10 text-orange-300" /> : <span className="text-white/30">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.balanceDue > 0 ? (
                  <span className="font-heading font-bold text-amber-300">{formatCurrency(row.balanceDue)}</span>
                ) : (
                  <span className="text-white/30">$0.00</span>
                )}
              </td>
              <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{formatCurrency(row.total)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <Link href={`/admin/invoices/${row.invoiceId}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
