// Manual backorder marking/resolution + the dual-status display: fulfillment
// status (Preparing/Packed/Shipped/...) and backorder condition (Active/
// Resolved/None) are always shown as two separate lines here, never merged —
// see lib/invoice/backorder.ts for why Backordered is never a
// DeliveryStatus value. Applying a backorder auto-applies/links the flat
// $25 compensation (lib/backorders.ts's applyCompensation) — nothing extra
// to trigger here beyond marking the item.
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption, mutedText } from './theme'
import type { DeliveryStatus } from '@prisma/client'

interface BackorderCompensationSummary {
  id: string
  totalAmount: number
  creditAppliedAmount: number
  refundAmount: number
  accountCreditAmount: number
  reason: string
  appliedAt: string
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

interface Props {
  invoiceId: string
  items: InvoiceItemOption[]
  deliveryStatus: DeliveryStatus
  onBackorderUpdated: () => void
}

export function BackordersSection({ invoiceId, items, deliveryStatus, onBackorderUpdated }: Props) {
  const [backorders, setBackorders] = useState<BackorderCondition[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [expectedAvailableDate, setExpectedAvailableDate] = useState('')
  const [notes, setNotes] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/backorders`)
      if (res.ok) setBackorders(await res.json())
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    refresh()
  }, [refresh])

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
        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-white/70 space-y-1">
          <p className="font-heading font-bold text-gold-light">
            {compensation.reason} — {formatMoney(compensation.totalAmount)} total
          </p>
          <p>
            {compensation.creditAppliedAmount > 0 ? `Credit applied: ${formatMoney(compensation.creditAppliedAmount)}. ` : ''}
            {compensation.refundAmount > 0 ? `Refunded: ${formatMoney(compensation.refundAmount)}. ` : ''}
            {compensation.accountCreditAmount > 0 ? `Account credit: ${formatMoney(compensation.accountCreditAmount)}.` : ''}
          </p>
          <p className={mutedText}>Applied {formatDate(compensation.appliedAt)} — one compensation covers every backorder on this invoice.</p>
        </div>
      ) : null}

      {backorders.length > 0 ? (
        <div className="space-y-3">
          {backorders.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white text-sm">{b.productName}</span>
                <StatusBadge status={b.status} variant="backorder" />
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <p>Applied {formatDate(b.appliedAt)}{b.expectedAvailableDate ? ` — expected available ${formatDate(b.expectedAvailableDate)}` : ''}</p>
                {b.notes ? <p className={mutedText}>Note: {b.notes}</p> : null}
                {b.status === 'RESOLVED' ? (
                  <p className="text-gold-light">
                    Resolved {formatDate(b.resolvedAt)}{b.resolutionNote ? ` — ${b.resolutionNote}` : ''}
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
