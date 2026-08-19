'use client'

// Admin -> Customers -> Bulk Portal Invite (2026-08-19 lead-capture/
// conversion engine addendum, section 8-12). Select existing direct-sale
// customers, preview a real eligibility breakdown, then send -- reusing
// the exact adoption-status classification and rollout safety gates the
// automated system already uses (see lib/portal/bulkInvite.ts).
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { card, pillPrimary, pillOutline, mutedText } from '@/components/invoices/theme'
import { PORTAL_ADOPTION_STATUS_LABEL, PORTAL_ADOPTION_STATUS_STYLE } from '@/lib/portal/adoptionStatusDisplay'
import type { PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'

export interface BulkInviteCustomerRow {
  id: string
  name: string
  email: string | null
  status: PortalAdoptionStatus
  reason: string | null
}

interface PreviewSummary {
  eligible: number
  alreadyActive: number
  alreadyInvited: number
  missingEmail: number
  identityReviewRequired: number
  otherExcluded: number
}

interface SendResult {
  haltedReason: 'KILL_SWITCH' | 'PAUSED' | null
  dryRun: boolean
  sent: number
  dryRunLogged: number
  skippedNotEligible: number
  skippedNotAllowlisted: number
  skippedNoEmail: number
  failed: number
}

export function BulkPortalInviteWorkspace({ customers }: { customers: BulkInviteCustomerRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<PreviewSummary | null>(null)
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<SendResult | null>(null)

  const eligibleIds = useMemo(() => customers.filter((c) => c.status === 'ELIGIBLE' || c.status === 'INVITE_PENDING').map((c) => c.id), [customers])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllEligible() {
    setSelected(new Set(eligibleIds))
  }

  function clearSelection() {
    setSelected(new Set())
    setConfirming(false)
    setPreview(null)
    setLastResult(null)
  }

  async function openPreview() {
    if (selected.size === 0) {
      toast.error('Select at least one customer.')
      return
    }
    try {
      const res = await fetch('/api/admin/customers/bulk-portal-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: [...selected], mode: 'preview' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Failed to build preview')
      const rows: { eligibleToInvite: boolean; status: PortalAdoptionStatus }[] = data.rows
      setPreview({
        eligible: rows.filter((r) => r.eligibleToInvite).length,
        alreadyActive: rows.filter((r) => r.status === 'PORTAL_ACTIVE').length,
        alreadyInvited: rows.filter((r) => ['INVITED', 'REMINDER_1_SENT', 'REMINDER_2_SENT'].includes(r.status)).length,
        missingEmail: rows.filter((r) => !r.eligibleToInvite && r.status === 'EXCLUDED').length,
        identityReviewRequired: rows.filter((r) => r.status === 'IDENTITY_REVIEW_REQUIRED').length,
        otherExcluded: rows.filter((r) => r.status === 'NOT_ELIGIBLE').length,
      })
      setConfirming(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to build preview')
    }
  }

  async function confirmSend() {
    setSending(true)
    try {
      const res = await fetch('/api/admin/customers/bulk-portal-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: [...selected], mode: 'send' }),
      })
      const data: SendResult = await res.json()
      if (!res.ok) throw new Error('Failed to send invitations')
      setLastResult(data)
      if (data.haltedReason) {
        toast.error(`Halted: ${data.haltedReason === 'KILL_SWITCH' ? 'rollout kill switch is active' : 'rollout is paused'}`)
      } else if (data.dryRun) {
        toast.success(`Dry run: ${data.dryRunLogged} invite(s) would have been sent. No real email was sent.`)
      } else {
        toast.success(`Sent ${data.sent} invitation(s).`)
      }
      setConfirming(false)
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitations')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex items-center justify-between flex-wrap gap-3`}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAllEligible} className={`${pillOutline} px-4 py-2 text-[12px]`}>
            Select All Eligible ({eligibleIds.length})
          </button>
          <button type="button" onClick={clearSelection} className={`${pillOutline} px-4 py-2 text-[12px]`} disabled={selected.size === 0}>
            Clear
          </button>
          <span className={`text-sm ${mutedText}`}>{selected.size} selected</span>
        </div>
        <button type="button" onClick={openPreview} disabled={selected.size === 0} className={`${pillPrimary} px-5 py-2`}>
          Preview Invitation
        </button>
      </div>

      {confirming && preview && (
        <div className={`${card} p-5 border-gold/30 space-y-4`}>
          <p className="font-heading text-[13px] font-bold uppercase tracking-[0.06em] text-white">Preview — {selected.size} selected</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><span className="text-emerald-300 font-bold">{preview.eligible}</span> <span className={mutedText}>eligible to invite</span></div>
            <div><span className="text-white font-bold">{preview.alreadyActive}</span> <span className={mutedText}>already active</span></div>
            <div><span className="text-white font-bold">{preview.alreadyInvited}</span> <span className={mutedText}>already invited</span></div>
            <div><span className="text-white font-bold">{preview.missingEmail}</span> <span className={mutedText}>missing/invalid email</span></div>
            <div><span className="text-amber-300 font-bold">{preview.identityReviewRequired}</span> <span className={mutedText}>identity review required</span></div>
            <div><span className="text-white font-bold">{preview.otherExcluded}</span> <span className={mutedText}>not yet eligible</span></div>
          </div>
          <p className={`text-xs ${mutedText}`}>
            Only the {preview.eligible} eligible customer(s) above will receive anything. This still runs through the
            same rollout safety gates as the automated system — if dry-run is on (the default), nothing is actually
            sent; this only logs what would have happened.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={confirmSend} disabled={sending || preview.eligible === 0} className={`${pillPrimary} px-6 py-2.5`}>
              {sending ? 'Sending…' : `Confirm — Invite ${preview.eligible} Customer${preview.eligible === 1 ? '' : 's'}`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={`${pillOutline} px-6 py-2.5`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className={`${card} p-5 space-y-1 text-sm`}>
          <p className="font-heading text-[13px] font-bold uppercase tracking-[0.06em] text-white mb-2">Last Run Result</p>
          {lastResult.haltedReason ? (
            <p className="text-red-300">Halted — {lastResult.haltedReason === 'KILL_SWITCH' ? 'rollout kill switch is active' : 'rollout is paused'}. Nothing was sent.</p>
          ) : (
            <>
              <p className={lastResult.dryRun ? 'text-amber-300' : 'text-emerald-300'}>
                {lastResult.dryRun ? `Dry run — ${lastResult.dryRunLogged} would have sent` : `Sent — ${lastResult.sent} real invitation(s)`}
              </p>
              {lastResult.skippedNotAllowlisted > 0 && <p className={mutedText}>{lastResult.skippedNotAllowlisted} skipped — not on the test allowlist</p>}
              {lastResult.skippedNoEmail > 0 && <p className={mutedText}>{lastResult.skippedNoEmail} skipped — no email</p>}
              {lastResult.failed > 0 && <p className="text-red-300">{lastResult.failed} failed</p>}
            </>
          )}
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 w-10"></th>
                <th className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3">Customer</th>
                <th className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3">Email</th>
                <th className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-gold" />
                  </td>
                  <td className="px-4 py-3 text-white whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3 text-white/60 whitespace-nowrap">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${PORTAL_ADOPTION_STATUS_STYLE[c.status]}`}>
                      {PORTAL_ADOPTION_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
