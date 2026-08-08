// Admin-editable CRM triage status (Phase 2B item 8) -- deliberately
// separate from StatusBadge's `variant="customer"` badge, which shows the
// automatically-recomputed fulfillment-lifecycle CustomerStatus and is
// never admin-settable. This control only ever touches Customer.leadStatus.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'] as const
export type LeadStatusValue = (typeof LEAD_STATUSES)[number]

const LEAD_STATUS_STYLE: Record<LeadStatusValue, string> = {
  NEW: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  CONTACTED: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
  QUALIFIED: 'bg-purple-400/10 text-purple-300 border border-purple-400/20',
  CONVERTED: 'bg-green-400/10 text-green-300 border border-green-400/20',
  CLOSED: 'bg-white/5 text-white/40 border border-white/10',
}

export function LeadStatusBadge({ status }: { status: LeadStatusValue }) {
  return (
    <span className={`text-xs font-heading font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${LEAD_STATUS_STYLE[status]}`}>
      {status}
    </span>
  )
}

export function CustomerLeadStatusControl({ customerId, leadStatus }: { customerId: string; leadStatus: LeadStatusValue }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function changeStatus(next: LeadStatusValue) {
    if (next === leadStatus) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadStatus: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update lead status')
      toast.success(`Lead status updated to ${next}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lead status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={leadStatus}
      disabled={saving}
      onChange={(e) => changeStatus(e.target.value as LeadStatusValue)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.06em] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
      aria-label="Lead status"
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-dark">
          {s}
        </option>
      ))}
    </select>
  )
}
