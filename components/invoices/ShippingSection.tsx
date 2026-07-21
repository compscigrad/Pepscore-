'use client'

import { card, input, label as labelClass, sectionHeading, selectOption } from './theme'
import { formatCarrierLabel } from '@/lib/invoice/format'
import type { ShippingFields, AddressDraft } from './types'
import type { ShippingCarrier, DeliveryStatus } from '@prisma/client'

interface Props {
  value: ShippingFields
  onChange: (value: ShippingFields) => void
}

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
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Shipping</h3>

      <p className={labelClass}>Ship To Address</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <input
          className={`${input} sm:col-span-2`}
          placeholder="Street address"
          value={value.shippingAddress.street1}
          onChange={(e) => setAddress('street1', e.target.value)}
        />
        <input
          className={input}
          placeholder="City"
          value={value.shippingAddress.city}
          onChange={(e) => setAddress('city', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            className={input}
            placeholder="State"
            value={value.shippingAddress.state}
            onChange={(e) => setAddress('state', e.target.value)}
          />
          <input
            className={input}
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
