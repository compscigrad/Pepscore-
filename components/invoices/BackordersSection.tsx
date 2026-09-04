// Manual backorder marking/resolution + the dual-status display: fulfillment
// status (Preparing/Packed/Shipped/...) and backorder condition (Active/
// Resolved/None) are always shown as two separate lines here, never merged —
// see lib/invoice/backorder.ts for why Backordered is never a
// DeliveryStatus value. Applying a backorder auto-applies/links the flat
// $25 compensation (lib/backorders.ts's applyCompensation) — nothing extra
// to trigger here beyond marking the item.
//
// Refund status is always shown as its own lifecycle, never implied by the
// compensation summary alone — a pending refund reads as pending until an
// admin explicitly completes it here (lib/backorders.ts's completeRefund).
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatDate, formatMomentDate } from '@/lib/invoice/format'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption, mutedText } from './theme'
import type { DeliveryStatus } from '@prisma/client'

type RefundStatus = 'PENDING' | 'AWAITING_MANUAL_PROCESSING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface RefundSummary {
  id: string
  requestedAmount: number
  completedAmount: number | null
  status: RefundStatus
  method: string | null
  providerTransactionId: string | null
  requestedAt: string
  completedAt: string | null
  failureReason: string | null
}

interface AccountCreditSummary {
  id: string
  amount: number
  remainingAmount: number
}

interface BackorderCompensationSummary {
  id: string
  totalAmount: number
  creditAppliedAmount: number
  refundAmount: number
  accountCreditAmount: number
  dispositionPreference: 'REFUND' | 'ACCOUNT_CREDIT'
  reason: string
  appliedAt: string
  refund: RefundSummary | null
  accountCredit: AccountCreditSummary | null
}

interface BackorderCondition {
  id: string
  invoiceItemId: string
  productName: string
  status: 'ACTIVE' | 'RESOLVED'
  expectedAvailableDate: string | null
  appliedAt: string
  appliedBy: string
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionNote: string | null
  notes: string | null
  compensationLinks: Array<{ backorderCompensation: BackorderCompensationSummary }>
}

interface InvoiceItemOption {
  id: string
  name: string
}

// Raw BackorderCompensation row shape (lib/backorders.ts's
// getBackorderCompensationSummary) — distinct from BackorderCompensationSummary
// above, which is the richer, nested-relation shape the /backorders GET
// route returns for the automatic-compensation display further down.
interface RawCompensation {
  id: string
  compensationType: 'AUTOMATIC' | 'DISCRETIONARY'
  totalAmount: number
  reason: string
  appliedAt: string
}

interface AccommodationSummary {
  automatic: RawCompensation | null
  discretionary: RawCompensation | null
}

interface Props {
  invoiceId: string
  items: InvoiceItemOption[]
  deliveryStatus: DeliveryStatus
  onBackorderUpdated: () => void
}

const REFUND_TERMINAL: RefundStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export function BackordersSection({ invoiceId, items, deliveryStatus, onBackorderUpdated }: Props) {
  const [backorders, setBackorders] = useState<BackorderCondition[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [expectedAvailableDate, setExpectedAvailableDate] = useState('')
  const [notes, setNotes] = useState('')
  const [preference, setPreference] = useState<'REFUND' | 'ACCOUNT_CREDIT'>('REFUND')
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [providerTxnId, setProviderTxnId] = useState('')
  const [failureReason, setFailureReason] = useState('')

  // Admin-discretionary accommodation state — a separate, independently
  // idempotent workflow from the automatic $25/$100-threshold policy above
  // (see lib/backorders.ts). Fetched separately since a discretionary
  // accommodation isn't linked to any specific BackorderCondition the way
  // the automatic credit is.
  const [accommodation, setAccommodation] = useState<AccommodationSummary | null>(null)
  const [accommodationAmount, setAccommodationAmount] = useState('')
  const [accommodationReason, setAccommodationReason] = useState('')
  const [accommodationPreview, setAccommodationPreview] = useState<{ projectedTotal: number; projectedBalanceDue: number } | null>(null)
  const [accommodationSubmitting, setAccommodationSubmitting] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [backordersRes, accommodationRes] = await Promise.all([
        fetch(`/api/admin/invoices/${invoiceId}/backorders`),
        fetch(`/api/admin/invoices/${invoiceId}/backorder-accommodation`),
      ])
      if (backordersRes.ok) setBackorders(await backordersRes.json())
      if (accommodationRes.ok) {
        const data = await accommodationRes.json()
        setAccommodation(data.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Live preview — debounced by the amount field's own onChange, fires a
  // fresh read-only preview every time the candidate amount changes so the
  // admin sees the projected invoice total before confirming.
  useEffect(() => {
    const amount = Number(accommodationAmount)
    if (!accommodationAmount || !Number.isFinite(amount) || amount <= 0) {
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/admin/invoices/${invoiceId}/backorder-accommodation?previewAmount=${amount}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setAccommodationPreview(data?.preview ?? null))
        .catch(() => {})
    }, 300)
    // Runs before the next effect execution (including when the amount
    // becomes invalid/empty and the branch above returns early) and on
    // unmount — clears any stale preview rather than leaving it showing a
    // now-outdated projection.
    return () => {
      clearTimeout(timer)
      controller.abort()
      setAccommodationPreview(null)
    }
  }, [accommodationAmount, invoiceId])

  async function applyAccommodation(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(accommodationAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid accommodation amount')
      return
    }
    if (!accommodationReason.trim()) {
      toast.error('Enter a reason for the accommodation')
      return
    }
    setAccommodationSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorder-accommodation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: accommodationReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to apply accommodation')
      toast.success('Backorder accommodation applied — customer notified')
      setAccommodationAmount('')
      setAccommodationReason('')
      setAccommodationPreview(null)
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply accommodation')
    } finally {
      setAccommodationSubmitting(false)
    }
  }

  async function adjustAccommodation(compensationId: string) {
    const newAmount = Number(adjustAmount)
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!adjustReason.trim()) {
      toast.error('Enter a reason for the change')
      return
    }
    setAccommodationSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorder-accommodation/${compensationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust', newAmount, reason: adjustReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to adjust accommodation')
      toast.success('Accommodation adjusted — customer notified')
      setAdjustingId(null)
      setAdjustAmount('')
      setAdjustReason('')
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust accommodation')
    } finally {
      setAccommodationSubmitting(false)
    }
  }

  async function removeAccommodation(compensationId: string) {
    setAccommodationSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorder-accommodation/${compensationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', reason: 'Removed by admin' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove accommodation')
      toast.success('Accommodation removed')
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove accommodation')
    } finally {
      setAccommodationSubmitting(false)
    }
  }

  const activeBackorders = backorders.filter((b) => b.status === 'ACTIVE')
  const itemsWithActiveBackorder = new Set(activeBackorders.map((b) => b.invoiceItemId))
  const availableItems = items.filter((i) => !itemsWithActiveBackorder.has(i.id))

  // Every backorder on this invoice ultimately links to at most one shared
  // compensation (the one-per-invoice rule) — collapse to that single record
  // for a top-line summary instead of repeating it per condition.
  const compensation = backorders.find((b) => b.compensationLinks.length > 0)?.compensationLinks[0]
    ?.backorderCompensation

  async function markBackordered(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItemId) {
      toast.error('Select a product to mark backordered')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceItemId: selectedItemId,
          expectedAvailableDate: expectedAvailableDate || undefined,
          notes: notes || undefined,
          preference: compensation ? undefined : preference,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to mark backordered')
      toast.success('Marked backordered — compensation applied')
      setSelectedItemId('')
      setExpectedAvailableDate('')
      setNotes('')
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark backordered')
    } finally {
      setSubmitting(false)
    }
  }

  async function resolve(backorderId: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorders/${backorderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNote: resolutionNotes[backorderId] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to resolve backorder')
      toast.success('Backorder resolved')
      setResolutionNotes((prev) => ({ ...prev, [backorderId]: '' }))
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve backorder')
    } finally {
      setSubmitting(false)
    }
  }

  async function refundAction(refundId: string, body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/refunds/${refundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update refund')
      toast.success(successMessage)
      setProviderTxnId('')
      setFailureReason('')
      await refresh()
      onBackorderUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update refund')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`${card} p-6 space-y-6`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className={sectionHeading}>Backorders</h3>
        {/* The dual-status display: fulfillment status and backorder
            condition are always two separate pills, never merged into one. */}
        <div className="flex items-center gap-4 text-xs">
          <span>
            <span className={mutedText}>Fulfillment status:</span>{' '}
            <StatusBadge status={deliveryStatus} variant="delivery" />
          </span>
          <span>
            <span className={mutedText}>Backorder condition:</span>{' '}
            {activeBackorders.length > 0 ? (
              <StatusBadge status="ACTIVE" variant="backorder" />
            ) : (
              <span className="text-white/40">None</span>
            )}
          </span>
        </div>
      </div>

      {compensation ? (
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-white/70 space-y-2">
          <p className="font-heading font-bold text-gold-light">
            {compensation.reason} — {formatMoney(compensation.totalAmount)} total
          </p>
          <p>
            {compensation.creditAppliedAmount > 0 ? `Invoice discount applied: ${formatMoney(compensation.creditAppliedAmount)}. ` : ''}
            {compensation.accountCreditAmount > 0 ? `Account credit issued: ${formatMoney(compensation.accountCreditAmount)}.` : ''}
          </p>

          {compensation.refund ? (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Refund — requested {formatMoney(compensation.refund.requestedAmount)}
                  {compensation.refund.completedAmount != null ? `, completed ${formatMoney(compensation.refund.completedAmount)}` : ''}
                </span>
                <StatusBadge status={compensation.refund.status} variant="refund" />
              </div>
              {compensation.refund.status === 'COMPLETED' ? (
                <p className={mutedText}>
                  Completed {formatMomentDate(compensation.refund.completedAt)}
                  {compensation.refund.method ? ` via ${compensation.refund.method}` : ''}
                  {compensation.refund.providerTransactionId ? ` — ref ${compensation.refund.providerTransactionId}` : ''}
                </p>
              ) : null}
              {compensation.refund.status === 'FAILED' && compensation.refund.failureReason ? (
                <p className="text-red-300">Failed: {compensation.refund.failureReason}</p>
              ) : null}
              {!REFUND_TERMINAL.includes(compensation.refund.status) ? (
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <div>
                    <label className={labelClass} htmlFor="providerTxnId">Provider Txn ID (optional)</label>
                    <input
                      id="providerTxnId"
                      className={`${input} w-40`}
                      value={providerTxnId}
                      onChange={(e) => setProviderTxnId(e.target.value)}
                      placeholder="e.g. terminal receipt #"
                    />
                  </div>
                  <button
                    type="button"
                    className={`${pillPrimary} px-4 py-2`}
                    disabled={submitting}
                    onClick={() =>
                      refundAction(
                        compensation.refund!.id,
                        { action: 'complete', providerTransactionId: providerTxnId || undefined },
                        'Refund marked completed — customer notified'
                      )
                    }
                  >
                    Mark Refund Completed
                  </button>
                  <div>
                    <label className={labelClass} htmlFor="failureReason">Failure Reason</label>
                    <input
                      id="failureReason"
                      className={`${input} w-40`}
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      placeholder="If it can't be completed"
                    />
                  </div>
                  <button
                    type="button"
                    className={`${pillOutline} px-4 py-2`}
                    disabled={submitting || !failureReason}
                    onClick={() => refundAction(compensation.refund!.id, { action: 'fail', failureReason }, 'Refund marked failed')}
                  >
                    Mark Failed
                  </button>
                </div>
              ) : null}
              {!REFUND_TERMINAL.includes(compensation.refund.status) ? (
                <p className={mutedText}>
                  No money has been recorded as returned until this refund is marked Completed — the customer has not
                  been told it&apos;s finished yet.
                </p>
              ) : null}
            </div>
          ) : null}

          <p className={mutedText}>Applied {formatMomentDate(compensation.appliedAt)} — one compensation covers every backorder on this invoice.</p>
        </div>
      ) : null}

      {/* Admin-discretionary accommodation — a separate, independently
          idempotent workflow from the automatic $25/$100-threshold policy
          above. Real-time customer-service adjustments (e.g. "$89 vial +
          backorder → $10 accommodation") that don't need to meet the
          automatic policy's minimum. */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-heading text-[13px] font-bold text-white">Backorder Accommodation (Discretionary)</h4>
          {accommodation?.automatic ? (
            <span className={`text-xs ${mutedText}`}>Automatic Backorder Credit: {formatMoney(accommodation.automatic.totalAmount)}</span>
          ) : null}
        </div>

        {accommodation?.discretionary ? (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-white/70 space-y-2">
            <p className="font-heading font-bold text-gold-light">
              Manual Backorder Accommodation: {formatMoney(accommodation.discretionary.totalAmount)}
            </p>
            <p>{accommodation.discretionary.reason}</p>
            <p className={mutedText}>Applied {formatMomentDate(accommodation.discretionary.appliedAt)}</p>

            {adjustingId === accommodation.discretionary.id ? (
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-white/10">
                <div>
                  <label className={labelClass} htmlFor="adjustAmount">New Amount ($)</label>
                  <input
                    id="adjustAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={`${input} w-28`}
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className={labelClass} htmlFor="adjustReason">Reason</label>
                  <input id="adjustReason" className={input} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                </div>
                <button
                  type="button"
                  className={`${pillPrimary} px-4 py-2`}
                  disabled={accommodationSubmitting}
                  onClick={() => adjustAccommodation(accommodation.discretionary!.id)}
                >
                  Save
                </button>
                <button type="button" className={`${pillOutline} px-4 py-2`} onClick={() => setAdjustingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className={`${pillOutline} px-4 py-2`}
                  onClick={() => {
                    setAdjustingId(accommodation.discretionary!.id)
                    setAdjustAmount(String(accommodation.discretionary!.totalAmount))
                    setAdjustReason('')
                  }}
                >
                  Adjust
                </button>
                <button
                  type="button"
                  className={`${pillOutline} px-4 py-2`}
                  disabled={accommodationSubmitting}
                  onClick={() => removeAccommodation(accommodation.discretionary!.id)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={applyAccommodation} className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass} htmlFor="accommodationAmount">Amount ($)</label>
              <input
                id="accommodationAmount"
                type="number"
                min="0.01"
                step="0.01"
                className={`${input} w-28`}
                value={accommodationAmount}
                onChange={(e) => setAccommodationAmount(e.target.value)}
                placeholder="10.00"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className={labelClass} htmlFor="accommodationReason">Reason</label>
              <input
                id="accommodationReason"
                className={input}
                value={accommodationReason}
                onChange={(e) => setAccommodationReason(e.target.value)}
                placeholder="e.g. In-person customer service adjustment"
              />
            </div>
            <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={accommodationSubmitting}>
              Apply Accommodation
            </button>
            {accommodationPreview ? (
              <p className={`w-full text-xs ${mutedText}`}>
                Preview: invoice becomes {formatMoney(accommodationPreview.projectedTotal)}, balance due{' '}
                {formatMoney(accommodationPreview.projectedBalanceDue)}.
              </p>
            ) : null}
          </form>
        )}
      </div>

      {backorders.length > 0 ? (
        <div className="space-y-3">
          {backorders.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white text-sm">{b.productName}</span>
                <StatusBadge status={b.status} variant="backorder" />
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <p>Applied {formatMomentDate(b.appliedAt)}{b.expectedAvailableDate ? ` — expected available ${formatDate(b.expectedAvailableDate)}` : ''}</p>
                {b.notes ? <p className={mutedText}>Note: {b.notes}</p> : null}
                {b.status === 'RESOLVED' ? (
                  <p className="text-gold-light">
                    Resolved {formatMomentDate(b.resolvedAt)}{b.resolutionNote ? ` — ${b.resolutionNote}` : ''}
                  </p>
                ) : null}
              </div>
              {b.status === 'ACTIVE' ? (
                <div className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-white/5">
                  <div className="flex-1 min-w-[160px]">
                    <label className={labelClass} htmlFor={`resNote-${b.id}`}>Resolution Note (optional)</label>
                    <input
                      id={`resNote-${b.id}`}
                      className={input}
                      value={resolutionNotes[b.id] ?? ''}
                      onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      placeholder="e.g. Restocked, shipping now"
                    />
                  </div>
                  <button type="button" className={`${pillOutline} px-4 py-2`} onClick={() => resolve(b.id)} disabled={submitting}>
                    Resolve Backorder
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${mutedText}`}>No backorders on this invoice.</p>
      )}

      {availableItems.length > 0 ? (
        <form onSubmit={markBackordered} className="pt-4 border-t border-white/5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className={labelClass} htmlFor="backorderItem">Product</label>
            <select
              id="backorderItem"
              className={input}
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              <option value="" className={selectOption}>Select a product…</option>
              {availableItems.map((i) => (
                <option key={i.id} value={i.id} className={selectOption}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="expectedDate">Expected Available</label>
            <input
              id="expectedDate"
              type="date"
              className={input}
              value={expectedAvailableDate}
              onChange={(e) => setExpectedAvailableDate(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={labelClass} htmlFor="backorderNotes">Notes (optional)</label>
            <input id="backorderNotes" className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {!compensation ? (
            <div>
              <label className={labelClass} htmlFor="disposition">If Money Is Owed Back</label>
              <select
                id="disposition"
                className={`${input} w-44`}
                value={preference}
                onChange={(e) => setPreference(e.target.value as 'REFUND' | 'ACCOUNT_CREDIT')}
              >
                <option value="REFUND" className={selectOption}>Pending Refund</option>
                <option value="ACCOUNT_CREDIT" className={selectOption}>Account Credit</option>
              </select>
            </div>
          ) : null}
          <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={submitting}>
            Mark Backordered
          </button>
        </form>
      ) : items.length > 0 ? (
        <p className={`text-xs ${mutedText}`}>Every product on this invoice already has an active backorder.</p>
      ) : null}
    </div>
  )
}
