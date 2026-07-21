// Explicit, always-visible control for the invoice's own status (separate
// from delivery status in ShippingSection and payment status derived from
// PaymentSection). Placed first in the builder — this is the field that
// decides whether the PDF a client receives still reads "Draft".
'use client'

import { card, input, label as labelClass, sectionHeading, selectOption } from './theme'
import { INVOICE_STATUSES, formatStatusLabel } from './types'
import type { InvoiceStatus } from '@prisma/client'

interface Props {
  value: InvoiceStatus
  onChange: (value: InvoiceStatus) => void
}

export function InvoiceStatusSection({ value, onChange }: Props) {
  return (
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Invoice Status</h3>
      <div className="max-w-xs">
        <label className={labelClass} htmlFor="invoiceStatus">Status</label>
        <select
          id="invoiceStatus"
          className={input}
          value={value}
          onChange={(e) => onChange(e.target.value as InvoiceStatus)}
        >
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s} className={selectOption}>{formatStatusLabel(s)}</option>
          ))}
        </select>
      </div>
      <p className="text-[12px] text-white/40 mt-3">
        The Recipient Receipt never shows this status to the customer — only the Master Invoice does, for your own reference. Set this to <strong className="text-white/60">Issued</strong> (or later) before sending a PDF to a client.
      </p>
    </div>
  )
}
