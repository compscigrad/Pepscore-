// Row-level Archive/Restore action, shared between the Sales Activity list
// (InvoiceTable.tsx) and the admin customer profile's Invoices section --
// same PATCH/DELETE calls, same busy-state handling, so both surfaces stay
// in sync with any future change to this flow.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from './theme'

interface Props {
  invoiceId: string
  archived: boolean
  // Callers that already manage their own client-fetched list (InvoiceTable)
  // pass their own refetch; server-component hosts (the admin customer
  // profile page) omit this and get the default router.refresh().
  onDone?: () => void | Promise<void>
}

export function InvoiceArchiveButton({ invoiceId, archived, onDone }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function archiveOrRestore() {
    setBusy(true)
    try {
      const res = archived
        ? await fetch(`/api/admin/invoices/${invoiceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore' }),
          })
        : await fetch(`/api/admin/invoices/${invoiceId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(archived ? 'Failed to restore invoice' : 'Failed to archive invoice')
      toast.success(archived ? 'Invoice restored' : 'Invoice archived')
      if (onDone) await onDone()
      else router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={archiveOrRestore}
      disabled={busy}
      className={`${pillOutline} px-3 py-1 text-[11px] disabled:opacity-40`}
    >
      {archived ? 'Restore' : 'Archive'}
    </button>
  )
}
