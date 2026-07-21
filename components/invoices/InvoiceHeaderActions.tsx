// Archive / restore / duplicate actions for the invoice edit page header.
// Small enough to not warrant a subfolder, but needs 'use client' for the
// button handlers, which the page itself (a server component) can't have.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from './theme'

interface Props {
  invoiceId: string
  archived: boolean
}

export function InvoiceHeaderActions({ invoiceId, archived }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  // Two-click confirm rather than a native confirm() dialog, consistent with
  // the rest of this dark-themed UI — first click arms it, a second click
  // within the window actually sends the trash request.
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function deleteInvoice() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setTimeout(() => setConfirmingDelete(false), 4000)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trash' }),
      })
      if (!res.ok) throw new Error('Failed to delete invoice')
      toast.success('Invoice moved to Trash')
      router.push('/admin/invoices')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice')
      setBusy(false)
      setConfirmingDelete(false)
    }
  }

  async function archiveOrRestore() {
    setBusy(true)
    try {
      if (archived) {
        const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        })
        if (!res.ok) throw new Error('Failed to restore invoice')
        toast.success('Invoice restored')
      } else {
        const res = await fetch(`/api/admin/invoices/${invoiceId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to archive invoice')
        toast.success('Invoice archived')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function duplicate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to duplicate invoice')
      toast.success(`Duplicated as ${data.invoiceNumber}`)
      router.push(`/admin/invoices/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate invoice')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={duplicate}
        disabled={busy}
        className={`${pillOutline} px-4 py-2`}
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={archiveOrRestore}
        disabled={busy}
        className={`${pillOutline} px-4 py-2`}
      >
        {archived ? 'Restore' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={deleteInvoice}
        disabled={busy}
        className={`${pillOutline} px-4 py-2 ${confirmingDelete ? 'border-red-400/40 text-red-300' : ''}`}
      >
        {confirmingDelete ? 'Click again to confirm' : 'Delete'}
      </button>
    </div>
  )
}
