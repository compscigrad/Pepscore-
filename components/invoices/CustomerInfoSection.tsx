// Controlled section: receives its slice of InvoiceBuilder's state and an
// onChange callback, holds none of its own — InvoiceBuilder stays the single
// source of truth so the live preview always reflects the current draft.
'use client'

import { card, input, label as labelClass, sectionHeading } from './theme'
import type { CustomerFields, AddressDraft } from './types'

interface Props {
  value: CustomerFields
  onChange: (value: CustomerFields) => void
}

export function CustomerInfoSection({ value, onChange }: Props) {
  function set<K extends keyof CustomerFields>(key: K, fieldValue: CustomerFields[K]) {
    onChange({ ...value, [key]: fieldValue })
  }

  function setAddress(field: keyof AddressDraft, fieldValue: string) {
    onChange({ ...value, billingAddress: { ...value.billingAddress, [field]: fieldValue } })
  }

  return (
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Customer Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="customerName">Customer Name *</label>
          <input
            id="customerName"
            className={input}
            value={value.customerName}
            onChange={(e) => set('customerName', e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerCompany">Company</label>
          <input
            id="customerCompany"
            className={input}
            value={value.customerCompany}
            onChange={(e) => set('customerCompany', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerEmail">Email</label>
          <input
            id="customerEmail"
            type="email"
            className={input}
            value={value.customerEmail}
            onChange={(e) => set('customerEmail', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerPhone">Phone</label>
          <input
            id="customerPhone"
            type="tel"
            className={input}
            value={value.customerPhone}
            onChange={(e) => set('customerPhone', e.target.value)}
          />
        </div>
      </div>

      <p className={`${labelClass} mt-5`}>Billing Address</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          className={`${input} sm:col-span-2`}
          placeholder="Street address"
          value={value.billingAddress.street1}
          onChange={(e) => setAddress('street1', e.target.value)}
        />
        <input
          className={input}
          placeholder="City"
          value={value.billingAddress.city}
          onChange={(e) => setAddress('city', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className={input}
            placeholder="State"
            value={value.billingAddress.state}
            onChange={(e) => setAddress('state', e.target.value)}
          />
          <input
            className={input}
            placeholder="ZIP"
            value={value.billingAddress.zip}
            onChange={(e) => setAddress('zip', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mt-5">
        <div>
          <label className={labelClass} htmlFor="publicNotes">Public Notes (shown to customer)</label>
          <textarea
            id="publicNotes"
            className={input}
            rows={2}
            value={value.publicNotes}
            onChange={(e) => set('publicNotes', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="internalNotes">Internal Notes (admin only)</label>
          <textarea
            id="internalNotes"
            className={input}
            rows={2}
            value={value.internalNotes}
            onChange={(e) => set('internalNotes', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
