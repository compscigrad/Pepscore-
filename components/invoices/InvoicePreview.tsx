// Live, no-reload preview — pure function of InvoiceBuilder's current state,
// styled to visually echo lib/invoice/pdf's layout (same section order: bill
// to / ship to, items table, totals) using real DOM/Tailwind rather than
// react-pdf's primitives. See docs/Decisions.md #3 for why this isn't
// pixel-identical to the generated PDF.
import Image from 'next/image'
import { formatMoney } from '@/lib/invoice/format'
import { lineItemTotal, resolveDiscountAmount, type InvoiceTotals } from '@/lib/invoice/calculations'
import type { InvoiceDraft } from './types'

interface Props {
  draft: InvoiceDraft
  totals: InvoiceTotals
  invoiceNumber?: string
}

export function InvoicePreview({ draft, totals, invoiceNumber }: Props) {
  const { customer, shipping, items, discounts } = draft

  return (
    <div className="bg-white rounded-2xl shadow-sl p-8 sticky top-8">
      {/* Centered logo + title, matching the PDF layout — the logo image
          already contains the "Pepscore Lab" wordmark, so no separate
          company-name text runs alongside it. */}
      <div className="flex flex-col items-center text-center mb-8">
        <Image src="/images/invoice-logo.jpeg" alt="Pepscore Lab" width={140} height={93} className="object-contain mb-2" />
        <p className="font-heading text-base font-bold text-dark tracking-[0.15em] uppercase">Invoice</p>
        <p className="text-[11px] text-g500 mt-1">{invoiceNumber || 'Draft — not yet saved'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-g100 rounded-lg p-3">
          <p className="text-[9px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">Bill To</p>
          <p className="text-[13px] text-dark">{customer.customerName || '—'}</p>
          {customer.customerCompany ? <p className="text-[13px] text-dark">{customer.customerCompany}</p> : null}
          {customer.customerEmail ? <p className="text-[12px] text-g700">{customer.customerEmail}</p> : null}
        </div>
        <div className="bg-g100 rounded-lg p-3">
          <p className="text-[9px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">Ship To</p>
          <p className="text-[13px] text-dark whitespace-pre-line">
            {[shipping.shippingAddress.street1, [shipping.shippingAddress.city, shipping.shippingAddress.state, shipping.shippingAddress.zip].filter(Boolean).join(', ')]
              .filter(Boolean)
              .join('\n') || '—'}
          </p>
          {shipping.carrier ? (
            <p className="text-[11px] text-g500 mt-1">
              {shipping.carrier}
              {shipping.trackingNumber ? ` — ${shipping.trackingNumber}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <table className="w-full text-[12px] mb-4">
        <thead>
          <tr className="border-b border-dark text-[9px] font-bold tracking-[0.08em] uppercase text-g500">
            <th className="text-left pb-1.5">Product</th>
            <th className="text-center pb-1.5">Qty</th>
            <th className="text-right pb-1.5">Price</th>
            <th className="text-right pb-1.5">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-g500 py-4">No products added yet</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.key} className="border-b border-g100">
                <td className="py-1.5 text-dark">{item.name || 'Untitled product'}</td>
                <td className="py-1.5 text-center text-g700">{item.quantity}</td>
                <td className="py-1.5 text-right text-g700">{formatMoney(item.unitPrice)}</td>
                <td className="py-1.5 text-right text-dark">{formatMoney(lineItemTotal(item))}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1 text-[12px]">
        <div className="flex justify-between text-g700"><span>Items</span><span>{formatMoney(totals.itemsTotal)}</span></div>
        <div className="flex justify-between text-g700"><span>Shipping</span><span>{formatMoney(shipping.shippingCost)}</span></div>
        <div className="flex justify-between text-g700"><span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span></div>
        {discounts.map((d) => (
          <div className="flex justify-between text-g700" key={d.key}>
            <span>{d.label || 'Discount'}</span>
            <span>-{formatMoney(resolveDiscountAmount(d, totals.itemsTotal))}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-dark pt-1.5 mt-1.5 font-heading font-bold text-dark">
          <span>Total</span>
          <span className="text-gold-dark">{formatMoney(totals.total)}</span>
        </div>
      </div>

      {customer.publicNotes ? (
        <div className="mt-6 pt-4 border-t border-g100">
          <p className="text-[9px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">Notes</p>
          <p className="text-[12px] text-g700">{customer.publicNotes}</p>
        </div>
      ) : null}
    </div>
  )
}
