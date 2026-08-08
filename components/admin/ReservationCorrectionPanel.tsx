'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { InventoryReservation } from '@prisma/client'

type ReservationRow = InventoryReservation & {
  product: { id: string; name: string; size: string; sku: string | null }
  invoice: { id: string; invoiceNumber: string; customerName: string; customerId: string | null }
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-400/10 text-green-300',
  RELEASED: 'bg-white/5 text-white/50',
  FULFILLED: 'bg-blue-400/10 text-blue-300',
}

type ActionKey = 'CORRECT_QUANTITY' | 'RELEASE' | 'RESTORE' | 'REVERSE_FULFILLMENT' | 'REAPPLY_FULFILLMENT' | 'MARK_RESOLVED' | null

const ACTION_LABEL: Record<Exclude<ActionKey, null>, string> = {
  CORRECT_QUANTITY: 'Correct Reservation',
  RELEASE: 'Release Incorrect Reservation',
  RESTORE: 'Restore Missing Reservation',
  REVERSE_FULFILLMENT: 'Reverse Fulfillment Deduction',
  REAPPLY_FULFILLMENT: 'Reapply Fulfillment Deduction',
  MARK_RESOLVED: 'Mark Resolved',
}

const AVAILABLE_ACTIONS: Record<string, Exclude<ActionKey, null>[]> = {
  ACTIVE: ['CORRECT_QUANTITY', 'RELEASE', 'MARK_RESOLVED'],
  RELEASED: ['RESTORE'],
  FULFILLED: ['REVERSE_FULFILLMENT'],
}

export function ReservationCorrectionPanel({ reservations, defaultStatus }: { reservations: ReservationRow[]; defaultStatus: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(defaultStatus)
  const [invoiceFilter, setInvoiceFilter] = useState(searchParams.get('invoiceId') ?? '')
  const [productFilter, setProductFilter] = useState(searchParams.get('productId') ?? '')

  const [activeRow, setActiveRow] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<ActionKey>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyFilters() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (invoiceFilter) params.set('invoiceId', invoiceFilter)
    if (productFilter) params.set('productId', productFilter)
    router.push(`/admin/inventory/reservations?${params.toString()}`)
  }

  function openAction(reservationId: string, action: Exclude<ActionKey, null>) {
    setActiveRow(reservationId)
    setActiveAction(action)
    setQuantity('')
    setReason('')
    setConfirmChecked(false)
    setError(null)
  }

  function resetForm() {
    setActiveRow(null)
    setActiveAction(null)
  }

  async function submit() {
    if (!activeRow || !activeAction) return
    if (activeAction !== 'REAPPLY_FULFILLMENT' && !reason.trim()) {
      setError('A reason is required.')
      return
    }
    if (!confirmChecked) {
      setError('Please confirm this correction before saving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> =
        activeAction === 'CORRECT_QUANTITY'
          ? { action: activeAction, quantity: Number(quantity), reason }
          : activeAction === 'REAPPLY_FULFILLMENT'
            ? { action: activeAction }
            : { action: activeAction, reason }
      const res = await fetch(`/api/admin/inventory/reservations/${activeRow}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Correction failed')
      }
      resetForm()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Correction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
      <div className="p-6 border-b border-white/10 flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white block focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
            <option value="ACTIVE" className="bg-white text-dark">Active</option>
            <option value="RELEASED" className="bg-white text-dark">Released</option>
            <option value="FULFILLED" className="bg-white text-dark">Fulfilled</option>
            <option value="" className="bg-white text-dark">All</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Invoice ID</span>
          <input value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)} className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white block focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 w-48" />
        </label>
        <label className="block">
          <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Product ID</span>
          <input value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white block focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 w-48" />
        </label>
        <button onClick={applyFilters} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-white hover:bg-gold-dark">
          Search
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10">
              {['Invoice', 'Customer', 'Product', 'Quantity', 'Status', 'Created', ''].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <>
                <tr key={r.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/invoices/${r.invoiceId}`} className="font-semibold text-white hover:text-gold-dark hover:underline">
                      {r.invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.invoice.customerId ? (
                      <Link href={`/admin/customers/${r.invoice.customerId}`} className="text-white hover:text-gold-dark hover:underline">
                        {r.invoice.customerName}
                      </Link>
                    ) : (
                      r.invoice.customerName
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/inventory/${r.productId}`} className="text-white hover:text-gold-dark hover:underline">
                      {r.product.name} {r.product.size}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-heading font-bold text-white">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {AVAILABLE_ACTIONS[r.status]?.map((action) => (
                      <button
                        key={action}
                        onClick={() => openAction(r.id, action)}
                        className="ml-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-heading font-bold text-white/80 hover:bg-white/5"
                      >
                        {ACTION_LABEL[action]}
                      </button>
                    ))}
                  </td>
                </tr>
                {activeRow === r.id && activeAction && (
                  <tr key={`${r.id}-form`} className="bg-white/[0.02]">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="max-w-lg">
                        <p className="font-heading text-[13px] font-bold text-white mb-2">{ACTION_LABEL[activeAction]}</p>
                        {activeAction === 'CORRECT_QUANTITY' && (
                          <input
                            type="number"
                            min={0}
                            placeholder="New quantity"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 mb-2 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
                          />
                        )}
                        {activeAction !== 'REAPPLY_FULFILLMENT' && (
                          <input
                            placeholder="Reason (required)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 mb-2 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
                          />
                        )}
                        <label className="flex items-center gap-2 text-[12px] text-white mb-2">
                          <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                          I confirm this correction is correct.
                        </label>
                        {error && <p className="text-[12px] text-red-400 mb-2">{error}</p>}
                        <div className="flex gap-2">
                          <button onClick={submit} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-white hover:bg-gold-dark">
                            Save
                          </button>
                          <button onClick={resetForm} className="rounded-lg border border-white/10 px-4 py-2 text-[13px] font-heading font-bold text-white/80 hover:bg-white/5">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {reservations.length === 0 && <div className="text-center py-16 text-white/50">No reservations match this filter.</div>}
      </div>
    </div>
  )
}
