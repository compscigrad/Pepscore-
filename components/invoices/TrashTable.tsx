// Trash view — invoices moved here via InvoiceHeaderActions' Delete button.
// Restore brings one back to the normal list; "Delete Forever" is the actual
// unrecoverable action, gated behind its own two-click confirm so a stray
// click can't destroy data (the API also refuses a permanent delete for
// anything not already sitting in this list, see lib/invoices.ts).
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'
import { StatusBadge } from './StatusBadge'
import { card, pillOutline } from './theme'

interface TrashedInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  total: number
  status: string
  deletedAt: string
}

interface Props {
  initialInvoices: TrashedInvoice[]
}

export function TrashTable({ initialInvoices }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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
      if (!res.ok) throw new Error('Failed to permanently delete invoice')
      setInvoices((prev) => prev.filter((inv) => inv.id !== id))
      toast.success('Invoice permanently deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to permanently delete invoice')
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-6 border-b border-white/10">
        <h2 className="font-heading text-[17px] font-bold text-white">Trash</h2>
        <p className="text-white/50 text-sm mt-1">
          Deleted invoices stay here until restored or permanently deleted.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Invoice #</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Customer</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Total</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Status</th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Deleted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/50 text-sm">
                  Trash is empty.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-white/70">{invoice.customerName}</td>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {new Date(invoice.deletedAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
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
                        disabled={busyId === invoice.id}
                        className={`${pillOutline} px-4 py-1.5 ${confirmingId === invoice.id ? 'border-red-400/40 text-red-300' : ''}`}
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
