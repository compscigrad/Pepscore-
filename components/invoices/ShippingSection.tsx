'use client'

import { useEffect, useRef } from 'react'
import { card, input, label as labelClass, sectionHeading, selectOption } from './theme'
import { formatCarrierLabel } from '@/lib/invoice/format'
import { useZipLookup } from './useZipLookup'
import type { ShippingFields, AddressDraft } from './types'
import type { ShippingCarrier, DeliveryStatus } from '@prisma/client'

interface Props {
  value: ShippingFields
  onChange: (value: ShippingFields) => void
  sameAsBilling: boolean
  onSameAsBillingChange: (checked: boolean) => void
}

const CARRIERS: ShippingCarrier[] = ['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']
const DELIVERY_STATUSES: DeliveryStatus[] = [
  'PREPARING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'LOST', 'DAMAGED',
]

export function ShippingSection({ value, onChange, sameAsBilling, onSameAsBillingChange }: Props) {
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  function set<K extends keyof ShippingFields>(key: K, fieldValue: ShippingFields[K]) {
    onChange({ ...value, [key]: fieldValue })
  }

  function setAddress(field: keyof AddressDraft, fieldValue: string) {
    onChange({ ...value, shippingAddress: { ...value.shippingAddress, [field]: fieldValue } })
  }

  const { handleZipChange, status: zipStatus, message: zipMessage } = useZipLookup(({ city, state }) => {
    const current = valueRef.current
    onChange({ ...current, shippingAddress: { ...current.shippingAddress, city, state } })
  })

  // While synced, the address sub-fields are driven entirely by
  // InvoiceBuilder copying billingAddress in — locking them here prevents
  // an edit that would silently diverge from billing without unchecking first.
  const addressFieldClass = sameAsBilling ? `${input} opacity-50 cursor-not-allowed` : input

  return (
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Shipping</h3>

      <div className="flex items-center justify-between mb-3">
        <p className={labelClass}>Ship To Address</p>
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-white/20 bg-white/5 text-gold focus:ring-gold/40"
            checked={sameAsBilling}
            onChange={(e) => onSameAsBillingChange(e.target.checked)}
          />
          Same as billing address
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <input
          className={`${addressFieldClass} sm:col-span-2`}
          placeholder="Street address"
          value={value.shippingAddress.street1}
          disabled={sameAsBilling}
          onChange={(e) => setAddress('street1', e.target.value)}
        />
        <input
          className={`${addressFieldClass} sm:col-span-2`}
          placeholder="Apt, suite, unit (optional)"
          value={value.shippingAddress.street2 ?? ''}
          disabled={sameAsBilling}
          onChange={(e) => setAddress('street2', e.target.value)}
        />
        <input
          className={addressFieldClass}
          placeholder="City"
          value={value.shippingAddress.city}
          disabled={sameAsBilling}
          onChange={(e) => setAddress('city', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className={addressFieldClass}
            placeholder="State"
            value={value.shippingAddress.state}
            disabled={sameAsBilling}
            onChange={(e) => setAddress('state', e.target.value)}
          />
          <div>
            <input
              className={addressFieldClass}
              placeholder="ZIP"
              value={value.shippingAddress.zip}
              disabled={sameAsBilling}
              onChange={(e) => {
                setAddress('zip', e.target.value)
                handleZipChange(e.target.value)
              }}
            />
            {!sameAsBilling && zipStatus === 'loading' ? (
              <p className="text-[11px] text-white/40 mt-1">Looking up city/state…</p>
            ) : null}
            {!sameAsBilling && zipStatus === 'error' && zipMessage ? (
              <p className="text-[11px] text-red-400 mt-1">{zipMessage}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelClass} htmlFor="carrier">Carrier</label>
          <select
            id="carrier"
            className={input}
            value={value.carrier}
            onChange={(e) => set('carrier', e.target.value as ShippingFields['carrier'])}
          >
            <option value="" className={selectOption}>Tracking Pending</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c} className={selectOption}>{formatCarrierLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="trackingNumber">Tracking #</label>
          <input
            id="trackingNumber"
            className={input}
            value={value.trackingNumber}
            onChange={(e) => set('trackingNumber', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="shippingCost">Shipping Cost</label>
          <input
            id="shippingCost"
            type="number"
            min={0}
            step="0.01"
            className={input}
            value={value.shippingCost}
            onChange={(e) => set('shippingCost', Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryStatus">Delivery Status</label>
          <select
            id="deliveryStatus"
            className={input}
            value={value.deliveryStatus}
            onChange={(e) => set('deliveryStatus', e.target.value as ShippingFields['deliveryStatus'])}
          >
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s} className={selectOption}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div>
          <label className={labelClass} htmlFor="shipDate">Ship Date</label>
          <input
            id="shipDate"
            type="date"
            className={input}
            value={value.shipDate}
            onChange={(e) => set('shipDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryDate">Est. Delivery</label>
          <input
            id="deliveryDate"
            type="date"
            className={input}
            value={value.deliveryDate}
            onChange={(e) => set('deliveryDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveredDate">Delivered Date</label>
          <input
            id="deliveredDate"
            type="date"
            className={input}
            value={value.deliveredDate}
            onChange={(e) => set('deliveredDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
