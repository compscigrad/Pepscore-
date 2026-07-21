// Carrier-agnostic shipment tracking — add/replace tracking, view normalized
// status + history, and the admin override controls from the tracking spec.
// Only meaningful once an invoice has a server id, same reasoning as
// PaymentSection: InvoiceBuilder only renders this in edit mode.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatCarrierLabel } from '@/lib/invoice/format'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption } from './theme'
import type { ShippingCarrier, ShippingStatus, Shipment, TrackingEvent } from '@prisma/client'

const CARRIERS: ShippingCarrier[] = ['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER']

const OVERRIDE_STATUSES: ShippingStatus[] = [
  'NOT_SHIPPED', 'TRACKING_ADDED', 'LABEL_CREATED', 'CARRIER_AWAITING_PACKAGE', 'ACCEPTED_BY_CARRIER',
  'IN_TRANSIT', 'DELAYED', 'DELIVERY_EXCEPTION', 'AVAILABLE_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'RETURNED_TO_SENDER', 'DELIVERY_ATTEMPTED', 'LOST', 'CANCELLED', 'UNKNOWN',
]

function formatStatusLabel(status: string): string {
  return status.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

interface Props {
  invoiceId: string
  shipment: (Shipment & { events: TrackingEvent[] }) | null
  onTrackingUpdated: () => void
}

export function TrackingSection({ invoiceId, shipment, onTrackingUpdated }: Props) {
  const [carrier, setCarrier] = useState<ShippingCarrier>('USPS')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [service, setService] = useState('')
  const [overrideStatus, setOverrideStatus] = useState<ShippingStatus>('IN_TRANSIT')
  const [showHistory, setShowHistory] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function addTracking(e: React.FormEvent) {
    e.preventDefault()
    if (!trackingNumber.trim()) {
      toast.error('Enter a tracking number')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber, service: service || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add tracking')
      // Format warnings are advisory only — the tracking number was already
      // saved and registered, per spec ("do not prevent saving").
      if (data.formatWarning) toast(data.formatWarning, { icon: '⚠️', duration: 6000 })
      toast.success(data.customerNotified ? 'Tracking added — customer notified' : 'Tracking added (no customer email on file — nothing sent)')
      setTrackingNumber('')
      setService('')
      onTrackingUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tracking')
    } finally {
      setSubmitting(false)
    }
  }

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      toast.success('Tracking updated')
      onTrackingUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true)
      setTimeout(() => setConfirmingRemove(false), 4000)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/tracking`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove tracking')
      toast.success('Tracking removed')
      onTrackingUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove tracking')
    } finally {
      setSubmitting(false)
      setConfirmingRemove(false)
    }
  }

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={sectionHeading}>Shipment Tracking</h3>
        {shipment ? <StatusBadge status={shipment.normalizedStatus} variant="shipping" /> : null}
      </div>

      {shipment ? (
        <div className="space-y-4">
          <div className="text-sm text-white/70 space-y-1">
            <p>
              <span className="text-white/50">Carrier:</span> {formatCarrierLabel(shipment.carrier)}
              {shipment.service ? ` — ${shipment.service}` : ''}
            </p>
            <p>
              <span className="text-white/50">Tracking #:</span>{' '}
              {shipment.trackingUrl ? (
                <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-gold-light hover:underline">
                  {shipment.trackingNumber}
                </a>
              ) : (
                shipment.trackingNumber
              )}
            </p>
            {shipment.dateShipped ? (
              <p><span className="text-white/50">Shipped:</span> {new Date(shipment.dateShipped).toLocaleString()}</p>
            ) : null}
            {shipment.deliveredAt ? (
              <p><span className="text-white/50">Delivered:</span> {new Date(shipment.deliveredAt).toLocaleString()}</p>
            ) : shipment.estimatedDeliveryAt ? (
              <p><span className="text-white/50">Est. delivery:</span> {new Date(shipment.estimatedDeliveryAt).toLocaleDateString()}</p>
            ) : null}
            {shipment.lastEventAt ? (
              <p><span className="text-white/50">Last update:</span> {new Date(shipment.lastEventAt).toLocaleString()}{shipment.carrierStatus ? ` — ${shipment.carrierStatus}` : ''}</p>
            ) : null}
            {!shipment.monitoringActive ? (
              <p className="text-white/40 text-xs">Monitoring stopped (terminal status or tracking removed).</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${pillOutline} px-4 py-1.5`} onClick={() => runAction('refresh')} disabled={submitting}>
              Refresh Tracking
            </button>
            <button type="button" className={`${pillOutline} px-4 py-1.5`} onClick={() => runAction('mark-delivered')} disabled={submitting}>
              Mark Delivered
            </button>
            <button type="button" className={`${pillOutline} px-4 py-1.5`} onClick={() => runAction('resend-notification')} disabled={submitting}>
              Resend Last Email
            </button>
            <button
              type="button"
              className={`${pillOutline} px-4 py-1.5 ${confirmingRemove ? 'border-red-400/40 text-red-300' : ''}`}
              onClick={remove}
              disabled={submitting}
            >
              {confirmingRemove ? 'Click again to confirm' : 'Remove Tracking'}
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass} htmlFor="overrideStatus">Override Status</label>
              <select
                id="overrideStatus"
                className={input}
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as ShippingStatus)}
              >
                {OVERRIDE_STATUSES.map((s) => (
                  <option key={s} value={s} className={selectOption}>{formatStatusLabel(s)}</option>
                ))}
              </select>
            </div>
            <button type="button" className={`${pillOutline} px-4 py-2`} onClick={() => runAction('override-status', { status: overrideStatus })} disabled={submitting}>
              Apply Override
            </button>
          </div>

          {shipment.events.length > 0 ? (
            <div>
              <button type="button" className="text-sm text-gold-light hover:underline" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? 'Hide' : 'View'} Tracking History ({shipment.events.length})
              </button>
              {showHistory ? (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {shipment.events.map((ev) => (
                    <div key={ev.id} className="text-xs text-white/60 border-b border-white/10 pb-2">
                      <span className="text-white/40">{new Date(ev.eventAt).toLocaleString()}</span> — {ev.description}
                      {ev.location ? ` (${ev.location})` : ''}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={addTracking} className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass} htmlFor="trackingCarrier">Carrier</label>
            <select id="trackingCarrier" className={input} value={carrier} onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}>
              {CARRIERS.map((c) => (
                <option key={c} value={c} className={selectOption}>{formatCarrierLabel(c)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={labelClass} htmlFor="trackingNum">Tracking Number</label>
            <input
              id="trackingNum"
              className={input}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Optional until shipped"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={labelClass} htmlFor="trackingService">Service</label>
            <input
              id="trackingService"
              className={input}
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. Priority Mail"
            />
          </div>
          <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={submitting}>
            Add Tracking
          </button>
        </form>
      )}
    </div>
  )
}
