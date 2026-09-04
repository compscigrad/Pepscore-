// Owner-controlled customer lifecycle (2026-09-03 sprint): TRUE delete for
// a record with zero business/financial history (test customer, accidental
// duplicate, abandoned lead), or Close/Archive for a real customer whose
// invoices/payments/credits/history must be preserved. Never both offered
// as equally-weighted buttons -- delete is gated behind a live eligibility
// check and reads its exact blocking reason when it can't run, matching
// MergeCustomerButton's own "preview first" precedent.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from '@/components/invoices/theme'

interface Eligibility {
  eligible: boolean
  blockedReasonLabels: string[]
}

export function CustomerLifecycleActions({
  customerId,
  accountClosedAt,
  accountArchivedAt,
}: {
  customerId: string
  accountClosedAt: Date | string | null
  accountArchivedAt: Date | string | null
}) {
  const router = useRouter()
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [armed, setArmed] = useState<'delete' | 'close' | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/customers/${customerId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEligibility({ eligible: Boolean(data.eligible), blockedReasonLabels: data.blockedReasonLabels ?? [] })
      })
      .catch(() => {
        if (!cancelled) setEligibility({ eligible: false, blockedReasonLabels: ['Could not check deletion eligibility.'] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  async function handleDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete customer')
      toast.success('Customer deleted')
      router.push('/admin/customers')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete customer')
      setBusy(false)
      setArmed(null)
    }
  }

  async function handleClose() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: closeReason || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to close account')
      toast.success('Account closed')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close account')
    } finally {
      setBusy(false)
      setArmed(null)
    }
  }

  async function handleArchive() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/archive`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to archive customer')
      toast.success('Customer archived')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive customer')
    } finally {
      setBusy(false)
    }
  }

  if (accountArchivedAt) {
    return <p className="text-[12px] text-white/40">Archived. Historical records are preserved.</p>
  }

  if (accountClosedAt) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-[12px] text-white/50">Account closed. Portal access disabled; history preserved.</p>
        <button type="button" onClick={handleArchive} disabled={busy} className={`${pillOutline} px-3 py-1 text-[11px] disabled:opacity-40`}>
          {busy ? 'Archiving…' : 'Archive'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {loading ? (
          <span className="text-[11px] text-white/30">Checking…</span>
        ) : eligibility?.eligible ? (
          armed === 'delete' ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/60">Permanently delete this customer? No invoices/orders/history exist to preserve.</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="px-3 py-1 rounded-full bg-red-400/20 text-red-300 text-[11px] font-bold hover:bg-red-400/30 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button type="button" onClick={() => setArmed(null)} disabled={busy} className="text-white/50 hover:text-white text-[11px]">
                Never mind
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setArmed('delete')}
              className={`${pillOutline} px-3 py-1 text-[11px] border-red-400/30 text-red-300 hover:bg-red-400/10`}
            >
              Delete Customer
            </button>
          )
        ) : (
          <div className="max-w-[420px]">
            <span className={`${pillOutline} inline-block px-3 py-1 text-[11px] opacity-40 cursor-not-allowed`}>Cannot delete</span>
            <div className="mt-1 space-y-0.5">
              {eligibility?.blockedReasonLabels.map((label) => (
                <p key={label} className="text-[11px] text-white/45 leading-relaxed">{label}</p>
              ))}
            </div>
          </div>
        )}

        {armed === 'close' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="Reason (optional)"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
            />
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold hover:bg-amber-400/30 disabled:opacity-50"
            >
              {busy ? 'Closing…' : 'Confirm Close'}
            </button>
            <button type="button" onClick={() => setArmed(null)} disabled={busy} className="text-white/50 hover:text-white text-[11px]">
              Never mind
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setArmed('close')}
            className={`${pillOutline} px-3 py-1 text-[11px] border-amber-400/30 text-amber-300 hover:bg-amber-400/10`}
          >
            Close Account
          </button>
        )}
      </div>
      <p className="text-[10px] text-white/35">
        Close disables portal access and preserves all invoices/payments/credits. It requires a $0 outstanding balance,
        same rule as customer self-service closure.
      </p>
    </div>
  )
}
