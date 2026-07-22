// Every shipment ever created for this invoice (multi-shipment supported —
// see docs/Decisions.md), the manual "Add Tracking" entry form (unchanged
// from the old TrackingSection, still the right path for a hand-written
// label or PICKUP/HAND_DELIVERY), and the new "Create Shipping Label" panel
// that actually buys postage through Shippo, gated by the Fulfillment Gate.
'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { formatCarrierLabel } from '@/lib/invoice/format'
import { getPrimaryShipment } from '@/lib/shipments/primary'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption, mutedText } from './theme'
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

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type ShipmentWithEvents = Shipment & { events: TrackingEvent[] }

interface ShippoRateOption {
  object_id: string
  amount: string
  provider: string
  servicelevel: { name: string; token: string }
  estimated_days: number
}

interface PackagePreset {
  id: string
  name: string
  weightOz: number
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
}

interface Eligibility {
  allowed: boolean
  reason?: 'PAID_IN_FULL' | 'ACTIVE_PAYMENT_ARRANGEMENT' | 'MANUAL_OVERRIDE'
}

const ELIGIBILITY_LABELS: Record<NonNullable<Eligibility['reason']>, string> = {
  PAID_IN_FULL: 'Paid in full',
  ACTIVE_PAYMENT_ARRANGEMENT: 'Active payment arrangement',
  MANUAL_OVERRIDE: 'Manually overridden',
}

interface Props {
  invoiceId: string
  shipments: ShipmentWithEvents[]
  onTrackingUpdated: () => void
}

export function ShipmentsSection({ invoiceId, shipments, onTrackingUpdated }: Props) {
  const primary = getPrimaryShipment(shipments)

  // ── Manual "Add Tracking" entry (unchanged behavior) ──────────────────────
  const [carrier, setCarrier] = useState<ShippingCarrier>('USPS')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [service, setService] = useState('')
  const [overrideStatus, setOverrideStatus] = useState<ShippingStatus>('IN_TRANSIT')
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [confirmingVoid, setConfirmingVoid] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Fulfillment Gate + label purchase ──────────────────────────────────────
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [presets, setPresets] = useState<PackagePreset[]>([])
  const [weightValue, setWeightValue] = useState(1)
  const [weightUnit, setWeightUnit] = useState<'oz' | 'lb'>('lb')
  const [lengthIn, setLengthIn] = useState(6)
  const [widthIn, setWidthIn] = useState(4)
  const [heightIn, setHeightIn] = useState(3)
  const [rates, setRates] = useState<ShippoRateOption[]>([])
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null)
  const [fetchingRates, setFetchingRates] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmingOverride, setConfirmingOverride] = useState(false)

  const refreshEligibility = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/fulfillment/eligibility`)
      if (!res.ok) return
      setEligibility(await res.json())
    } catch {
      // Silent — the purchase button just stays conservatively disabled.
    }
  }, [invoiceId])

  useEffect(() => {
    const t = setTimeout(() => {
      refreshEligibility()
      fetch('/api/admin/package-presets')
        .then((res) => (res.ok ? res.json() : { presets: [] }))
        .then((data) => setPresets(data.presets ?? []))
        .catch(() => {})
    }, 0)
    return () => clearTimeout(t)
  }, [refreshEligibility])

  function applyPreset(presetId: string) {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    setWeightValue(preset.weightOz)
    setWeightUnit('oz')
    if (preset.lengthIn) setLengthIn(preset.lengthIn)
    if (preset.widthIn) setWidthIn(preset.widthIn)
    if (preset.heightIn) setHeightIn(preset.heightIn)
  }

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

  async function removePrimaryTracking() {
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

  async function voidOneShipment(shipmentId: string) {
    if (confirmingVoid !== shipmentId) {
      setConfirmingVoid(shipmentId)
      setTimeout(() => setConfirmingVoid((v) => (v === shipmentId ? null : v)), 4000)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/shipments/${shipmentId}/void`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to void shipment')
      toast.success('Shipment voided')
      onTrackingUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void shipment')
    } finally {
      setSubmitting(false)
      setConfirmingVoid(null)
    }
  }

  async function fulfillAnyway() {
    if (!confirmingOverride) {
      setConfirmingOverride(true)
      setTimeout(() => setConfirmingOverride(false), 4000)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/fulfillment/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Manually approved for fulfillment before normal payment requirements were met.' }),
      })
      if (!res.ok) throw new Error('Failed to override')
      toast.success('Fulfillment override recorded')
      await refreshEligibility()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to override')
    } finally {
      setSubmitting(false)
      setConfirmingOverride(false)
    }
  }

  async function getRates() {
    setFetchingRates(true)
    setRates([])
    setSelectedRateId(null)
    try {
      const params = new URLSearchParams({
        weightValue: String(weightValue),
        weightUnit,
        lengthIn: String(lengthIn),
        widthIn: String(widthIn),
        heightIn: String(heightIn),
      })
      const res = await fetch(`/api/admin/invoices/${invoiceId}/shipments/rates?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch rates')
      setRates(data.rates ?? [])
      if ((data.rates ?? []).length === 0) toast('No rates returned for this package', { icon: 'ℹ️' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch rates')
    } finally {
      setFetchingRates(false)
    }
  }

  async function purchase() {
    const rate = rates.find((r) => r.object_id === selectedRateId)
    if (!rate) {
      toast.error('Select a rate first')
      return
    }
    setPurchasing(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateObjectId: rate.object_id,
          carrier: carrierFromProvider(rate.provider),
          service: rate.servicelevel.name,
          weightValue,
          weightUnit,
          lengthIn,
          widthIn,
          heightIn,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to purchase label')
      toast.success('Label purchased — tracking started automatically')
      if (data.labelUrl) window.open(data.labelUrl, '_blank', 'noopener,noreferrer')
      setRates([])
      setSelectedRateId(null)
      onTrackingUpdated()
      refreshEligibility()
    } catch (err) {
      // Per the spec: display the actual Shippo error here, not a generic
      // message — the admin needs the exact reason to fix and retry. The
      // entered package form (weight/dims/rate selection) is intentionally
      // left as-is on failure so nothing has to be re-typed.
      toast.error(err instanceof Error ? err.message : 'Failed to purchase label', { duration: 8000 })
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className={`${card} p-6 space-y-6`}>
      <div className="flex items-center justify-between">
        <h3 className={sectionHeading}>Shipments</h3>
        {primary ? <StatusBadge status={primary.normalizedStatus} variant="shipping" /> : null}
      </div>

      {/* ── All shipments, newest first ─────────────────────────────────── */}
      {shipments.length > 0 ? (
        <div className="space-y-3">
          {shipments.map((shipment) => {
            const isPrimary = shipment.id === primary?.id
            return (
              <div
                key={shipment.id}
                className={`rounded-xl border p-4 ${
                  shipment.voidedAt ? 'border-white/5 bg-white/[0.01] opacity-60' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isPrimary && !shipment.voidedAt ? (
                      <span className="text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-gold-light">Current</span>
                    ) : null}
                    {shipment.voidedAt ? (
                      <span className="text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-red-300">Voided</span>
                    ) : null}
                    {shipment.origin === 'LABEL_PURCHASE' ? (
                      <span className="text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-white/40">Purchased Label</span>
                    ) : null}
                  </div>
                  <StatusBadge status={shipment.normalizedStatus} variant="shipping" />
                </div>

                <div className="text-sm text-white/70 space-y-1">
                  <p>
                    <span className={mutedText}>Carrier:</span> {formatCarrierLabel(shipment.carrier)}
                    {shipment.service ? ` — ${shipment.service}` : ''}
                  </p>
                  <p>
                    <span className={mutedText}>Tracking #:</span>{' '}
                    {shipment.trackingUrl ? (
                      <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-gold-light hover:underline">
                        {shipment.trackingNumber}
                      </a>
                    ) : (
                      shipment.trackingNumber
                    )}
                  </p>
                  {shipment.postageAmount != null ? (
                    <p><span className={mutedText}>Postage:</span> {formatMoney(shipment.postageAmount)}</p>
                  ) : null}
                  {shipment.labelUrl ? (
                    <p>
                      <a href={shipment.labelUrl} target="_blank" rel="noreferrer" className="text-gold-light hover:underline">
                        Open label PDF
                      </a>
                    </p>
                  ) : null}
                  {shipment.dateShipped ? (
                    <p><span className={mutedText}>Shipped:</span> {new Date(shipment.dateShipped).toLocaleString()}</p>
                  ) : null}
                  {shipment.deliveredAt ? (
                    <p><span className={mutedText}>Delivered:</span> {new Date(shipment.deliveredAt).toLocaleString()}</p>
                  ) : shipment.estimatedDeliveryAt ? (
                    <p><span className={mutedText}>Est. delivery:</span> {new Date(shipment.estimatedDeliveryAt).toLocaleDateString()}</p>
                  ) : null}
                  {shipment.lastEventAt ? (
                    <p>
                      <span className={mutedText}>Last update:</span> {new Date(shipment.lastEventAt).toLocaleString()}
                      {shipment.carrierStatus ? ` — ${shipment.carrierStatus}` : ''}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {isPrimary && !shipment.voidedAt ? (
                    <>
                      <button type="button" className={`${pillOutline} px-3 py-1 text-xs`} onClick={() => runAction('refresh')} disabled={submitting}>
                        Refresh
                      </button>
                      <button type="button" className={`${pillOutline} px-3 py-1 text-xs`} onClick={() => runAction('mark-delivered')} disabled={submitting}>
                        Mark Delivered
                      </button>
                      <button type="button" className={`${pillOutline} px-3 py-1 text-xs`} onClick={() => runAction('resend-notification')} disabled={submitting}>
                        Resend Last Email
                      </button>
                      <button
                        type="button"
                        className={`${pillOutline} px-3 py-1 text-xs ${confirmingRemove ? 'border-red-400/40 text-red-300' : ''}`}
                        onClick={removePrimaryTracking}
                        disabled={submitting}
                      >
                        {confirmingRemove ? 'Click again to confirm' : 'Stop Monitoring'}
                      </button>
                    </>
                  ) : null}
                  {!shipment.voidedAt ? (
                    <button
                      type="button"
                      className={`${pillOutline} px-3 py-1 text-xs ${confirmingVoid === shipment.id ? 'border-red-400/40 text-red-300' : ''}`}
                      onClick={() => voidOneShipment(shipment.id)}
                      disabled={submitting}
                    >
                      {confirmingVoid === shipment.id ? 'Click again to confirm' : 'Void Shipment'}
                    </button>
                  ) : null}
                  {shipment.events.length > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-gold-light hover:underline px-1"
                      onClick={() => setShowHistory((v) => (v === shipment.id ? null : shipment.id))}
                    >
                      {showHistory === shipment.id ? 'Hide' : 'View'} History ({shipment.events.length})
                    </button>
                  ) : null}
                </div>

                {isPrimary && !shipment.voidedAt ? (
                  <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-white/5">
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
                    <button
                      type="button"
                      className={`${pillOutline} px-4 py-2`}
                      onClick={() => runAction('override-status', { status: overrideStatus })}
                      disabled={submitting}
                    >
                      Apply Override
                    </button>
                  </div>
                ) : null}

                {showHistory === shipment.id ? (
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
            )
          })}
        </div>
      ) : (
        <p className={`text-sm ${mutedText}`}>No shipments yet.</p>
      )}

      {/* ── Manual "Add Tracking" — always available ─────────────────────── */}
      <div className="pt-4 border-t border-white/5">
        <p className={`${labelClass} mb-2`}>Add Tracking Manually</p>
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
              placeholder="From an existing label"
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
      </div>

      {/* ── Create Shipping Label (real Shippo purchase) ─────────────────── */}
      <div className="pt-4 border-t border-white/5 space-y-3">
        <p className={labelClass}>Create Shipping Label</p>

        {eligibility ? (
          eligibility.allowed ? (
            <p className="text-xs text-gold-light">
              Eligible for fulfillment{eligibility.reason ? ` — ${ELIGIBILITY_LABELS[eligibility.reason]}` : ''}.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs text-amber-300">Not yet eligible — invoice must be paid in full or have an active payment arrangement.</p>
              <button
                type="button"
                className={`${pillOutline} px-3 py-1 text-xs ${confirmingOverride ? 'border-red-400/40 text-red-300' : ''}`}
                onClick={fulfillAnyway}
                disabled={submitting}
              >
                {confirmingOverride ? 'Click again to confirm' : 'Fulfill Anyway'}
              </button>
            </div>
          )
        ) : null}

        {presets.length > 0 ? (
          <div className="max-w-xs">
            <label className={labelClass} htmlFor="packagePreset">Package Preset</label>
            <select id="packagePreset" className={input} defaultValue="" onChange={(e) => e.target.value && applyPreset(e.target.value)}>
              <option value="" className={selectOption}>Choose a preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id} className={selectOption}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass} htmlFor="weightValue">Weight</label>
            <div className="flex gap-2">
              <input
                id="weightValue"
                type="number"
                min="0"
                step="0.1"
                className={`${input} w-24`}
                value={weightValue}
                onChange={(e) => setWeightValue(Number(e.target.value))}
              />
              <select className={`${input} w-20`} value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'oz' | 'lb')}>
                <option value="lb" className={selectOption}>lb</option>
                <option value="oz" className={selectOption}>oz</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="lengthIn">Length (in)</label>
            <input id="lengthIn" type="number" min="0" step="0.5" className={`${input} w-24`} value={lengthIn} onChange={(e) => setLengthIn(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="widthIn">Width (in)</label>
            <input id="widthIn" type="number" min="0" step="0.5" className={`${input} w-24`} value={widthIn} onChange={(e) => setWidthIn(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="heightIn">Height (in)</label>
            <input id="heightIn" type="number" min="0" step="0.5" className={`${input} w-24`} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
          </div>
          <button type="button" className={`${pillOutline} px-4 py-2`} onClick={getRates} disabled={fetchingRates}>
            {fetchingRates ? 'Fetching Rates…' : 'Get Rates'}
          </button>
        </div>

        {rates.length > 0 ? (
          <div className="space-y-2">
            {rates.map((rate) => (
              <label
                key={rate.object_id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  selectedRateId === rate.object_id ? 'border-gold/40 bg-gold/5' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rate"
                    checked={selectedRateId === rate.object_id}
                    onChange={() => setSelectedRateId(rate.object_id)}
                  />
                  {rate.provider} — {rate.servicelevel.name}
                  <span className={mutedText}>({rate.estimated_days}d)</span>
                </span>
                <span className="font-heading font-bold text-gold-light">{formatMoney(parseFloat(rate.amount))}</span>
              </label>
            ))}
            <button
              type="button"
              className={`${pillPrimary} px-5 py-2`}
              onClick={purchase}
              disabled={purchasing || !selectedRateId || !eligibility?.allowed}
            >
              {purchasing ? 'Purchasing…' : 'Purchase Label'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Shippo's rate.provider is a display name ("USPS", "FedEx", ...) — map it
// back onto our own ShippingCarrier enum for storage.
function carrierFromProvider(provider: string): ShippingCarrier {
  const normalized = provider.toUpperCase()
  if (normalized.includes('USPS')) return 'USPS'
  if (normalized.includes('UPS')) return 'UPS'
  if (normalized.includes('FEDEX')) return 'FEDEX'
  if (normalized.includes('DHL')) return 'DHL'
  return 'OTHER'
}
