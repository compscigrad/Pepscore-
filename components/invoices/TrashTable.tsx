// Trash view — invoices moved here via InvoiceHeaderActions' Delete button.
// Restore brings one back to the normal list; "Delete Forever" (single) and
// "Delete Selected" (bulk) are the actual unrecoverable actions.
//
// (2026-08-12 admin optimization sprint) Eligibility is computed server-side
// per invoice (lib/invoices/deletionEligibility.ts) and passed in as props --
// an invoice with real payments/refunds/shipments/inventory movement/
// promotion redemptions/Finance records can't be selected at all, with the
// exact reason shown, rather than letting the click fail after the fact.
// Bulk delete requires typing an exact confirmation phrase; single delete
// keeps its existing two-click confirm (low blast radius, already gated).
'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'
import { StatusBadge } from './StatusBadge'
import { card, pillOutline, pillPrimary, mutedText } from './theme'

interface TrashedInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  total: number
  status: string
  deletedAt: string
  eligible: boolean
  blockedReasons: string[]
}

interface Props {
  initialInvoices: TrashedInvoice[]
}

export function TrashTable({ initialInvoices }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkConfirmText, setBulkConfirmText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const eligibleSelectedCount = useMemo(
    () => invoices.filter((inv) => selected.has(inv.id) && inv.eligible).length,
    [invoices, selected]
  )
  const requiredPhrase = `DELETE ${eligibleSelectedCount} INVOICES`

  async function restore(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore-from-trash' }),
      })
      if (!res.ok) throw new Error('Failed to restore invoice')
      setInvoices((prev) => prev.filter((inv) => inv.id !== id))
      toast.success('Invoice restored')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore invoice')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteForever(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id)
      setTimeout(() => setConfirmingId((current) => (current === id ? null : current)), 4000)
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/invoices/${id}/permanent`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to permanently delete invoice')
      }
      setInvoices((prev) => prev.filter((inv) => inv.id !== id))
      toast.success('Invoice permanently deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to permanently delete invoice')
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  function toggleSelect(inv: TrashedInvoice) {
    if (!inv.eligible) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(inv.id)) next.delete(inv.id)
      else next.add(inv.id)
      return next
    })
  }

  async function confirmBulkDelete() {
    if (bulkConfirmText !== requiredPhrase) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/invoices/trash/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Bulk delete failed')
      }
      const data = await res.json()
      const deletedIds = new Set<string>(data.deleted.map((d: { id: string }) => d.id))
      setInvoices((prev) => prev.filter((inv) => !deletedIds.has(inv.id)))
      setSelected(new Set())
      setBulkConfirmOpen(false)
      setBulkConfirmText('')
      toast.success(`Permanently deleted ${data.deleted.length} invoice${data.deleted.length === 1 ? '' : 's'}${data.blocked.length ? ` — ${data.blocked.length} blocked` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-[17px] font-bold text-white">Trash</h2>
          <p className={`${mutedText} text-sm mt-1`}>Deleted invoices stay here until restored or permanently deleted.</p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setBulkConfirmOpen(true)}
            disabled={eligibleSelectedCount === 0}
            className={`${pillPrimary} px-5 py-2 bg-red-500/80 hover:bg-red-500 disabled:opacity-40`}
          >
            Delete Selected ({eligibleSelectedCount})
          </button>
        )}
      </div>

      {bulkConfirmOpen && (
        <div className="p-6 border-b border-red-400/20 bg-red-400/[0.04]">
          <p className="text-white font-heading font-bold text-[14px]">
            Permanently delete {eligibleSelectedCount} eligible invoice{eligibleSelectedCount === 1 ? '' : 's'}?
          </p>
          <p className={`${mutedText} text-[12px] mt-1`}>This action cannot be undone. Type <span className="text-red-300 font-mono">{requiredPhrase}</span> to confirm.</p>
          <div className="flex items-center gap-3 mt-3">
            <input
              value={bulkConfirmText}
              onChange={(e) => setBulkConfirmText(e.target.value)}
              placeholder={requiredPhrase}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/20 w-[260px] focus:outline-none focus:ring-2 focus:ring-red-400/40"
            />
            <button
              type="button"
              onClick={confirmBulkDelete}
              disabled={bulkConfirmText !== requiredPhrase || bulkBusy}
              className={`${pillPrimary} px-5 py-2 bg-red-500/80 hover:bg-red-500 disabled:opacity-40`}
            >
              {bulkBusy ? 'Deleting…' : 'Permanently Delete'}
            </button>
            <button type="button" onClick={() => { setBulkConfirmOpen(false); setBulkConfirmText('') }} className={`${pillOutline} px-5 py-2`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3" />
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Invoice #</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Customer</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Total</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Status</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Deleted</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Eligibility</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/50 text-sm">
                  Trash is empty.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(invoice.id)}
                      onChange={() => toggleSelect(invoice)}
                      disabled={!invoice.eligible}
                      title={invoice.eligible ? 'Select for bulk delete' : invoice.blockedReasons.join('; ')}
                      className="disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-white/70">{invoice.customerName}</td>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {new Date(invoice.deletedAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3">
                    {invoice.eligible ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold bg-green-400/10 text-green-300">Eligible</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold bg-amber-400/10 text-amber-300" title={invoice.blockedReasons.join('; ')}>
                        Blocked: {invoice.blockedReasons[0]}{invoice.blockedReasons.length > 1 ? ` +${invoice.blockedReasons.length - 1}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => restore(invoice.id)}
                        disabled={busyId === invoice.id}
                        className={`${pillOutline} px-4 py-1.5`}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteForever(invoice.id)}
                        disabled={busyId === invoice.id || !invoice.eligible}
                        title={invoice.eligible ? undefined : invoice.blockedReasons.join('; ')}
                        className={`${pillOutline} px-4 py-1.5 disabled:opacity-30 ${confirmingId === invoice.id ? 'border-red-400/40 text-red-300' : ''}`}
                      >
                        {confirmingId === invoice.id ? 'Confirm forever?' : 'Delete Forever'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
