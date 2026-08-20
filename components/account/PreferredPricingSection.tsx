// Customer-portal display of active Preferred Pricing (Price Match sprint,
// 2026-08-20). Deliberately customer-safe only -- product/variant/sell
// unit/price/validity/status, never competitor proof, admin review notes,
// or any other customer's data (lib/priceMatch/requests.ts's
// listCustomerPreferredPricing() already scopes the query to this
// customerId and selects only these fields). Purely informational, same as
// the storefront's own "Your Preferred Price" display -- the canonical
// pricing engine is what actually enforces this at checkout.
import Link from 'next/link'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'
import { SELL_UNIT_DISPLAY_LABEL } from '@/lib/pricing/sellUnits'
import type { CustomerPreferredPricingRow } from '@/lib/priceMatch/requests'

function formatValidity(row: CustomerPreferredPricingRow): string {
  if (row.status === 'REDEEMED') return 'Used (one-time match)'
  if (row.authorizationType === 'UNTIL_REVOKED') return 'Valid until revoked'
  if (row.authorizationType === 'ONE_PURCHASE') return 'Valid for one purchase'
  if (row.expiresAt) return `Valid through ${row.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  return 'Active'
}

export function PreferredPricingSection({ rows }: { rows: CustomerPreferredPricingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={`${card} p-6 space-y-2`}>
        <h3 className={sectionHeading}>Preferred Pricing</h3>
        <p className={mutedText}>
          No active preferred pricing yet. Found a lower price elsewhere?{' '}
          <Link href="/price-match" className="text-gold-light hover:underline">
            Request a Price Match
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className={`${card} p-6 space-y-3`}>
      <h3 className={sectionHeading}>Preferred Pricing</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="border border-white/10 rounded-xl p-4 flex items-start justify-between flex-wrap gap-2">
            <div>
              <p className="text-white font-semibold">{row.productName} ({row.productSize})</p>
              <p className={`${mutedText} text-[13px]`}>{SELL_UNIT_DISPLAY_LABEL[row.sellUnit as keyof typeof SELL_UNIT_DISPLAY_LABEL] ?? row.sellUnit.replace(/_/g, ' ')}</p>
              <p className={`${mutedText} text-[12px] mt-0.5`}>{formatValidity(row)}</p>
            </div>
            <p className="font-heading text-[20px] font-bold text-gold-light">${row.authorizedPrice.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
