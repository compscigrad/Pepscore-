'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, pillPrimary, sectionHeading } from './theme'
import type { ShippingStatus } from '@prisma/client'

interface Props {
  initialEnabled: Partial<Record<ShippingStatus, boolean>>
}

// Only the statuses that ever trigger a customer email are configurable here
// — matches lib/tracking/notifications.ts's NOTIFICATION_STATUSES exactly.
const NOTIFICATION_TOGGLES: { value: ShippingStatus; label: string }[] = [
  { value: 'TRACKING_ADDED', label: 'Tracking number added' },
  { value: 'ACCEPTED_BY_CARRIER', label: 'Shipment accepted by carrier' },
  { value: 'IN_TRANSIT', label: 'Shipment in transit' },
  { value: 'DELAYED', label: 'Shipment delayed' },
  { value: 'DELIVERY_EXCEPTION', label: 'Delivery exception' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED_TO_SENDER', label: 'Returned to sender' },
]

export function TrackingNotificationSettingsForm({ initialEnabled }: Props) {
  // A status missing from the saved map defaults to enabled (see
  // lib/invoiceSettings.ts's isNotificationEnabled) — mirror that default
  // here so an untouched setting still shows as checked.
  const [enabled, setEnabled] = useState<Record<ShippingStatus, boolean>>(() => {
    const initial: Partial<Record<ShippingStatus, boolean>> = {}
    for (const { value } of NOTIFICATION_TOGGLES) {
      initial[value] = initialEnabled[value] !== false
    }
    return initial as Record<ShippingStatus, boolean>
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNotificationsEnabled: enabled }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('Notification settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-lg`}>
      <h2 className={`${sectionHeading} mb-1`}>Customer shipment email notifications</h2>
      <p className="text-white/50 text-sm mb-4">
        Turn off any event type below to stop emailing customers for it. Never sends more than one
        email per invoice per status.
      </p>
      <div className="space-y-2">
        {NOTIFICATION_TOGGLES.map((toggle) => (
          <label key={toggle.value} className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled[toggle.value]}
              onChange={(e) => setEnabled((prev) => ({ ...prev, [toggle.value]: e.target.checked }))}
              className="accent-gold"
            />
            {toggle.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`${pillPrimary} px-6 py-2.5 mt-6`}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
