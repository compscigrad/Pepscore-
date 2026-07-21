// Read-only totals display, driven entirely by lib/invoice/calculations.ts
// output — never computes anything itself, so it can't drift from the
// number the server will actually save.
import { formatMoney } from '@/lib/invoice/format'
import { card, sectionHeading } from './theme'
import type { InvoiceTotals } from '@/lib/invoice/calculations'

interface Props {
  totals: InvoiceTotals
  shippingCost: number
  amountPaid?: number
}

export function TotalsSummary({ totals, shippingCost, amountPaid = 0 }: Props) {
  const itemsTotal = totals.itemsTotal

  return (
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Totals</h3>
      <div className="space-y-2 text-sm">
        <Row label="Items" value={formatMoney(itemsTotal)} />
        <Row label="Shipping" value={formatMoney(shippingCost)} />
        <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
        {totals.discountTotal > 0 && <Row label="Discounts" value={`-${formatMoney(totals.discountTotal)}`} />}
        <div className="border-t border-white/10 pt-2 mt-2">
          <Row label="Total" value={formatMoney(totals.total)} bold />
        </div>
        {amountPaid > 0 && (
          <>
            <Row label="Amount Paid" value={formatMoney(amountPaid)} />
            <Row label="Balance Due" value={formatMoney(totals.balanceDue)} bold accent />
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'font-heading font-bold text-white' : 'text-white/70'}>{label}</span>
      <span className={bold ? `font-heading font-bold ${accent ? 'text-gold-light' : 'text-white'}` : 'text-white'}>
        {value}
      </span>
    </div>
  )
}
