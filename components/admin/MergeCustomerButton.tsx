// Merges a "possible duplicate" into the currently-viewed customer (Phase
// 4E) -- the record on this page always survives; `loserId` is deleted
// after everything real it owned (invoices, orders via portal identity,
// promotions, correspondence, etc.) is reassigned here. Fetches a preview
// on mount so a genuinely-blocked merge (two separate real portal logins,
// two Stripe customers, two first-order-offer claims) renders disabled
// with its exact reason up front, rather than only failing after a click.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from '@/components/invoices/theme'

interface MergeConflict {
  reason: string
  message: string
}

export function MergeCustomerButton({ survivorId, loserId, loserName }: { survivorId: string; loserId: string; loserName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [conflicts, setConflicts] = useState<MergeConflict[] | null>(null)
  const [armed, setArmed] = useState(false)
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/customers/${survivorId}/merge?loserId=${loserId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setConflicts(data.conflicts ?? [])
      })
      .catch(() => {
        if (!cancelled) setConflicts([{ reason: 'PREVIEW_FAILED', message: 'Could not check whether this merge is safe.' }])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [survivorId, loserId])

  async function handleMerge() {
    setMerging(true)
    try {
      const res = await fetch(`/api/admin/customers/${survivorId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to merge these customers')
      toast.success(`Merged ${loserName} into this record`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge these customers')
    } finally {
      setMerging(false)
      setArmed(false)
    }
  }

  if (loading) return <span className="text-[11px] text-white/30">Checking…</span>

  if (conflicts && conflicts.length > 0) {
    return (
      <div className="max-w-[360px]">
        <span className={`${pillOutline} inline-block px-3 py-1 text-[11px] opacity-40 cursor-not-allowed`}>Cannot merge automatically</span>
        <div className="mt-1 space-y-1">
          {conflicts.map((c) => (
            <p key={c.reason} className="text-[11px] text-white/45 leading-relaxed">
              {c.message}
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className={`${pillOutline} px-3 py-1 text-[11px] border-amber-400/30 text-amber-300 hover:bg-amber-400/10`}
      >
        Merge into this record
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/60">Merge {loserName} into this record? This deletes their record.</span>
      <button
        type="button"
        onClick={handleMerge}
        disabled={merging}
        className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold hover:bg-amber-400/30 disabled:opacity-50"
      >
        {merging ? 'Merging…' : 'Confirm Merge'}
      </button>
      <button type="button" onClick={() => setArmed(false)} disabled={merging} className="text-white/50 hover:text-white text-[11px]">
        Never mind
      </button>
    </div>
  )
}
