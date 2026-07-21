// Controlled section: receives its slice of InvoiceBuilder's state and an
// onChange callback, holds none of its own — InvoiceBuilder stays the single
// source of truth so the live preview always reflects the current draft.
'use client'

import type { CustomerFields, AddressDraft } from './types'

interface Props {
  value: CustomerFields
  onChange: (value: CustomerFields) => void
}

const inputClass =
  'w-full rounded-lg border border-g300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40'
const labelClass = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5'

export function CustomerInfoSection({ value, onChange }: Props) {
  function set<K extends keyof CustomerFields>(key: K, fieldValue: CustomerFields[K]) {
    onChange({ ...value, [key]: fieldValue })
  }

  function setAddress(field: keyof AddressDraft, fieldValue: string) {
    onChange({ ...value, billingAddress: { ...value.billingAddress, [field]: fieldValue } })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sh">
      <h3 className="font-heading text-[15px] font-bold text-dark mb-4">Customer Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="customerName">Customer Name *</label>
          <input
            id="customerName"
            className={inputClass}
            value={value.customerName}
            onChange={(e) => set('customerName', e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerCompany">Company</label>
          <input
            id="customerCompany"
            className={inputClass}
            value={value.customerCompany}
            onChange={(e) => set('customerCompany', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerEmail">Email</label>
          <input
            id="customerEmail"
            type="email"
            className={inputClass}
            value={value.customerEmail}
            onChange={(e) => set('customerEmail', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerPhone">Phone</label>
          <input
            id="customerPhone"
            type="tel"
            className={inputClass}
            value={value.customerPhone}
            onChange={(e) => set('customerPhone', e.target.value)}
          />
        </div>
      </div>

      <p className={`${labelClass} mt-5`}>Billing Address</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          className={`${inputClass} sm:col-span-2`}
          placeholder="Street address"
          value={value.billingAddress.street1}
          onChange={(e) => setAddress('street1', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="City"
          value={value.billingAddress.city}
          onChange={(e) => setAddress('city', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className={inputClass}
            placeholder="State"
            value={value.billingAddress.state}
            onChange={(e) => setAddress('state', e.target.value)}
          />
          <input
            className={inputClass}
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
            className={inputClass}
            rows={2}
            value={value.publicNotes}
            onChange={(e) => set('publicNotes', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="internalNotes">Internal Notes (admin only)</label>
          <textarea
            id="internalNotes"
            className={inputClass}
            rows={2}
            value={value.internalNotes}
            onChange={(e) => set('internalNotes', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
