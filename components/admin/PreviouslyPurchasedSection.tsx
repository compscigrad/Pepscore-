// Admin-assisted reorder (Phase 3C item 3): shows every product/sell-unit
// this customer has genuinely purchased before, each resolved against the
// CURRENT product state (never a historical price). "Add to New Invoice"
// links straight into the create-invoice flow with the line pre-populated
// -- app/admin/invoices/new/page.tsx re-resolves the line itself server-side
// before seeding the draft, so a line that goes unavailable between this
// page rendering and the admin clicking through is caught there, not here.
import Link from 'next/link'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { REORDER_UNAVAILABLE_MESSAGE, type ResolvedReorderLine } from '@/lib/storefront/reorder'
import { card, mutedText, sectionHeading, pillPrimary } from '@/components/invoices/theme'

export interface PreviouslyPurchasedLine {
  productId: string
  sellUnit: string | null
  productLabel: string
  purchasedAt: Date
  resolved: ResolvedReorderLine
}

interface ReorderLinePayload {
  productId: string
  sellUnit: string | null
  quantity: number
}

function reorderHref(customerId: string, lines: ReorderLinePayload[]): string {
  return `/admin/invoices/new?customerId=${customerId}&reorderItems=${encodeURIComponent(JSON.stringify(lines))}`
}

export function PreviouslyPurchasedSection({ customerId, lines }: { customerId: string; lines: PreviouslyPurchasedLine[] }) {
  if (lines.length === 0) return null

  const resolvable = lines.filter((l) => l.resolved.status === 'RESOLVED')

  return (
    <div className={`${card} p-6 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={sectionHeading}>Previously Purchased</h3>
        {resolvable.length > 0 ? (
          <Link
            href={reorderHref(
              customerId,
              resolvable.map((l) => ({ productId: l.productId, sellUnit: l.resolved.status === 'RESOLVED' ? l.resolved.sellUnit : null, quantity: l.resolved.status === 'RESOLVED' ? l.resolved.quantity : 1 }))
            )}
            className={`${pillPrimary} px-4 py-2 text-sm`}
          >
            Add All to New Invoice
          </Link>
        ) : null}
      </div>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={`${line.productId}-${line.sellUnit ?? 'CASE_STANDARD'}`} className="flex items-center justify-between gap-3 text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
            <div>
              <p className="text-white">{line.productLabel}</p>
              <p className={`${mutedText} text-xs`}>
                Last purchased {formatDate(line.purchasedAt)}
                {line.resolved.status === 'RESOLVED' ? ` — ${formatMoney(line.resolved.unitPrice)}${line.resolved.backordered ? ' (Backorder)' : ''}` : ''}
              </p>
            </div>
            {line.resolved.status === 'RESOLVED' ? (
              <Link
                href={reorderHref(customerId, [{ productId: line.productId, sellUnit: line.resolved.sellUnit, quantity: line.resolved.quantity }])}
                className="text-gold-light hover:text-gold text-[11px] font-heading font-bold uppercase tracking-[0.06em] whitespace-nowrap"
              >
                Add to New Invoice
              </Link>
            ) : (
              <span className="text-white/30 text-[11px] whitespace-nowrap">{REORDER_UNAVAILABLE_MESSAGE[line.resolved.reason]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
