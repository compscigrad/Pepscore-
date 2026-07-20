'use client'

import type { ShippingFields, AddressDraft } from './types'
import type { ShippingCarrier, DeliveryStatus } from '@prisma/client'

interface Props {
  value: ShippingFields
  onChange: (value: ShippingFields) => void
}

const inputClass =
  'w-full rounded-lg border border-g300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40'
const labelClass = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5'

const CARRIERS: ShippingCarrier[] = ['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']
const DELIVERY_STATUSES: DeliveryStatus[] = [
  'PREPARING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'LOST', 'DAMAGED',
]

export function ShippingSection({ value, onChange }: Props) {
  function set<K extends keyof ShippingFields>(key: K, fieldValue: ShippingFields[K]) {
    onChange({ ...value, [key]: fieldValue })
  }

  function setAddress(field: keyof AddressDraft, fieldValue: string) {
    onChange({ ...value, shippingAddress: { ...value.shippingAddress, [field]: fieldValue } })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sh">
      <h3 className="font-heading text-[15px] font-bold text-dark mb-4">Shipping</h3>

      <p className={labelClass}>Ship To Address</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <input
          className={`${inputClass} sm:col-span-2`}
          placeholder="Street address"
          value={value.shippingAddress.street1}
          onChange={(e) => setAddress('street1', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="City"
          value={value.shippingAddress.city}
          onChange={(e) => setAddress('city', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className={inputClass}
            placeholder="State"
            value={value.shippingAddress.state}
            onChange={(e) => setAddress('state', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="ZIP"
            value={value.shippingAddress.zip}
            onChange={(e) => setAddress('zip', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelClass} htmlFor="carrier">Carrier</label>
          <select
            id="carrier"
            className={inputClass}
            value={value.carrier}
            onChange={(e) => set('carrier', e.target.value as ShippingFields['carrier'])}
          >
            <option value="">Tracking Pending</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="trackingNumber">Tracking #</label>
          <input
            id="trackingNumber"
            className={inputClass}
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
            className={inputClass}
            value={value.shippingCost}
            onChange={(e) => set('shippingCost', Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryStatus">Delivery Status</label>
          <select
            id="deliveryStatus"
            className={inputClass}
            value={value.deliveryStatus}
            onChange={(e) => set('deliveryStatus', e.target.value as ShippingFields['deliveryStatus'])}
          >
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
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
            className={inputClass}
            value={value.shipDate}
            onChange={(e) => set('shipDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryDate">Est. Delivery</label>
          <input
            id="deliveryDate"
            type="date"
            className={inputClass}
            value={value.deliveryDate}
            onChange={(e) => set('deliveryDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveredDate">Delivered Date</label>
          <input
            id="deliveredDate"
            type="date"
            className={inputClass}
            value={value.deliveredDate}
            onChange={(e) => set('deliveredDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
