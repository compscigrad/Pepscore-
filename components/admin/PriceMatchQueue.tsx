// Admin Price Match review queue (2026-08-20 Price Match sprint). Approving
// a request creates a real PriceMatchAuthorization -- the persistent
// Customer Preferred Pricing grant the canonical pricing engine reads at
// checkout/invoice time -- with an exact authorized price (never a
// percentage) and one of three admin-selected durations. Mirrors
// ProfessionalAccessQueue.tsx's structure (tabs, per-row action panel).
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline, pillSecondary, input } from '@/components/invoices/theme'

type RequestStatus = 'PENDING' | 'MORE_INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'
type AuthorizationType = 'ONE_PURCHASE' | 'UNTIL_DATE' | 'UNTIL_REVOKED'
type ProofDeliveryStatus = 'NONE' | 'SENT' | 'FAILED' | 'RECEIVED_EXTERNALLY'

const REJECTION_REASONS = ['PRICE_ALREADY_COMPETITIVE', 'COMPETITOR_NOT_VERIFIABLE', 'PRODUCT_NOT_COMPARABLE', 'INSUFFICIENT_PROOF', 'OUTSIDE_POLICY', 'DUPLICATE_REQUEST', 'OTHER'] as const

const PROOF_STATUS_LABEL: Record<ProofDeliveryStatus, string> = {
  NONE: 'No supporting file provided',
  SENT: 'Provided — delivered to Admin email',
  FAILED: 'Proof email delivery failed',
  RECEIVED_EXTERNALLY: 'Proof received externally',
}
const PROOF_STATUS_CLASS: Record<ProofDeliveryStatus, string> = {
  NONE: 'text-white/40',
  SENT: 'text-green-400',
  FAILED: 'text-red-400',
  RECEIVED_EXTERNALLY: 'text-blue-300',
}

interface RequestRow {
  id: string
  requestNumber: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  sellUnit: string
  competitorName: string
  competitorUrl: string | null
  competitorPrice: number
  competitorShippingCost: number | null
  competitorDeliveredPrice: number
  proofUrl: string | null
  proofNote: string | null
  proofProvided: boolean
  proofFileName: string | null
  proofFileSize: number | null
  proofDeliveryStatus: ProofDeliveryStatus
  customerNote: string | null
  status: RequestStatus
  rejectionReason: string | null
  reviewNotes: string | null
  createdAt: string
  customer: { id: string; firstName: string; lastName: string; email: string | null } | null
  product: { id: string; name: string; size: string; activeStandardCasePrice: number | null; activeProCasePrice: number | null; activeBulkPrice: number | null; activeIndividualVialPrice: number | null }
  authorization: { id: string; code: string; status: string; authorizationType: AuthorizationType } | null
}

const STATUS_TABS: { value: RequestStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'MORE_INFO_REQUESTED', label: 'More Info Requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'ALL', label: 'All' },
]

const STATUS_BADGE: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-400/15 text-amber-300',
  MORE_INFO_REQUESTED: 'bg-blue-500/15 text-blue-300',
  APPROVED: 'bg-green-500/15 text-green-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  WITHDRAWN: 'bg-white/10 text-white/50',
}

function currentPriceFor(product: RequestRow['product'], sellUnit: string): number | null {
  switch (sellUnit) {
    case 'CASE_STANDARD': return product.activeStandardCasePrice
    case 'CASE_PRO': return product.activeProCasePrice
    case 'CASE_BULK': return product.activeBulkPrice
    case 'INDIVIDUAL_VIAL': return product.activeIndividualVialPrice
    default: return null
  }
}

type Panel = 'none' | 'approve' | 'reject' | 'more_info'

export function PriceMatchQueue() {
  const [tab, setTab] = useState<RequestStatus | 'ALL'>('PENDING')
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [panelByRow, setPanelByRow] = useState<Record<string, Panel>>({})

  const [priceByRow, setPriceByRow] = useState<Record<string, string>>({})
  const [durationByRow, setDurationByRow] = useState<Record<string, AuthorizationType>>({})
  const [expiresByRow, setExpiresByRow] = useState<Record<string, string>>({})
  const [reasonByRow, setReasonByRow] = useState<Record<string, string>>({})
  const [noteByRow, setNoteByRow] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const qs = tab === 'ALL' ? '' : `?status=${tab}`
      const res = await fetch(`/api/admin/price-match${qs}`)
      if (res.ok) setRequests((await res.json()).requests)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  function openPanel(id: string, panel: Panel) {
    setPanelByRow((prev) => ({ ...prev, [id]: prev[id] === panel ? 'none' : panel }))
  }

  async function confirmApprove(row: RequestRow) {
    const priceStr = priceByRow[row.id]
    const price = priceStr ? parseFloat(priceStr) : NaN
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid authorized price')
      return
    }
    const authorizationType = durationByRow[row.id] ?? 'ONE_PURCHASE'
    if (authorizationType === 'UNTIL_DATE' && !expiresByRow[row.id]) {
      toast.error('Choose an expiration date')
      return
    }
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/price-match/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          authorizedPrice: price,
          authorizationType,
          expiresAt: authorizationType === 'UNTIL_DATE' ? new Date(expiresByRow[row.id]).toISOString() : undefined,
          reviewNotes: noteByRow[row.id] || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to approve')
      toast.success('Price match approved')
      openPanel(row.id, 'none')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmReject(row: RequestRow) {
    const reason = reasonByRow[row.id]
    if (!reason) {
      toast.error('Choose a rejection reason')
      return
    }
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/price-match/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: reason, reviewNotes: noteByRow[row.id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reject')
      toast.success('Request rejected')
      openPanel(row.id, 'none')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmMoreInfo(row: RequestRow) {
    const note = noteByRow[row.id]
    if (!note || !note.trim()) {
      toast.error('Enter what additional info is needed')
      return
    }
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/price-match/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_more_info', note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to request more info')
      toast.success('More information requested')
      openPanel(row.id, 'none')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request more info')
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(row: RequestRow) {
    if (!row.authorization) return
    if (!window.confirm('Revoke this preferred price? The customer will return to standard pricing.')) return
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/price-match/authorizations/${row.authorization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke')
      toast.success('Preferred price revoked')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
    } finally {
      setBusyId(null)
    }
  }

  async function markReceivedExternally(row: RequestRow) {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/price-match/${row.id}/proof-received-externally`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update')
      toast.success('Proof marked as received externally')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className={sectionHeading}>Price Match Requests</h3>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${
                tab === t.value ? pillPrimary : pillOutline
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className={mutedText}>Loading…</p>
      ) : requests.length === 0 ? (
        <p className={`${mutedText} text-center py-8`}>No requests in this view.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((row) => {
            const currentPrice = currentPriceFor(row.product, row.sellUnit)
            const panel = panelByRow[row.id] ?? 'none'
            return (
              <div key={row.id} className="border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-heading font-bold text-white">{row.product.name} ({row.product.size}) · {row.sellUnit.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-white/40 font-mono">{row.requestNumber}</p>
                    <p className="text-[13px] text-white/60">{row.contactName} · {row.contactEmail}{row.contactPhone ? ` · ${row.contactPhone}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[row.status]}`}>
                    {row.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] mb-3">
                  <div><dt className="text-white/40">Competitor</dt><dd className="text-white/80">{row.competitorName}{row.competitorUrl ? ` (${row.competitorUrl})` : ''}</dd></div>
                  <div><dt className="text-white/40">Their delivered price</dt><dd className="text-white/80">${row.competitorDeliveredPrice.toFixed(2)}</dd></div>
                  <div><dt className="text-white/40">Our current price</dt><dd className="text-white/80">{currentPrice != null ? `$${currentPrice.toFixed(2)}` : 'n/a'}</dd></div>
                  {row.proofUrl && (<div><dt className="text-white/40">Proof link</dt><dd className="text-white/80">{row.proofUrl}</dd></div>)}
                </dl>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-[12px] font-semibold ${PROOF_STATUS_CLASS[row.proofDeliveryStatus]}`}>
                    PROOF — {PROOF_STATUS_LABEL[row.proofDeliveryStatus]}
                    {row.proofFileName ? ` (${row.proofFileName}${row.proofFileSize ? `, ${Math.round(row.proofFileSize / 1024)}KB` : ''})` : ''}
                  </span>
                  {(row.proofDeliveryStatus === 'NONE' || row.proofDeliveryStatus === 'FAILED') && (
                    <button onClick={() => markReceivedExternally(row)} disabled={busyId === row.id} className="text-[11px] text-[#D4AF37] hover:underline">
                      Mark Received Externally
                    </button>
                  )}
                </div>

                {row.customerNote && <p className="text-[13px] text-white/70 mb-3 whitespace-pre-line">{row.customerNote}</p>}
                {row.reviewNotes && <p className="text-[12px] text-white/40 mb-3">Review notes: {row.reviewNotes}</p>}
                {row.authorization && (
                  <p className="text-[12px] text-[#D4AF37] mb-3">
                    Authorization {row.authorization.code} · {row.authorization.authorizationType.replace(/_/g, ' ')} · {row.authorization.status}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap mb-2">
                  {row.status !== 'APPROVED' && row.status !== 'REJECTED' && (
                    <>
                      <button onClick={() => openPanel(row.id, 'approve')} disabled={busyId === row.id} className={`${pillPrimary} px-3 py-1.5 text-[11px]`}>Approve</button>
                      <button onClick={() => openPanel(row.id, 'reject')} disabled={busyId === row.id} className={`${pillOutline} px-3 py-1.5 text-[11px]`}>Reject</button>
                      <button onClick={() => openPanel(row.id, 'more_info')} disabled={busyId === row.id} className={`${pillSecondary} px-3 py-1.5 text-[11px]`}>Request More Info</button>
                    </>
                  )}
                  {row.status === 'APPROVED' && row.authorization && row.authorization.status === 'ACTIVE' && (
                    <button onClick={() => revoke(row)} disabled={busyId === row.id} className="px-3 py-1.5 text-[11px] rounded-full border border-red-400/40 text-red-300 hover:bg-red-400/10">
                      Revoke
                    </button>
                  )}
                </div>

                {panel === 'approve' && (
                  <div className="border border-[#D4AF37]/20 rounded-lg p-3 space-y-2 bg-[#D4AF37]/[0.03]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number" step="0.01" min="0.01"
                        placeholder="Authorized price"
                        className={`${input} text-[12px]`}
                        value={priceByRow[row.id] ?? ''}
                        onChange={(e) => setPriceByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                      <select
                        className={`${input} text-[12px]`}
                        value={durationByRow[row.id] ?? 'ONE_PURCHASE'}
                        onChange={(e) => setDurationByRow((prev) => ({ ...prev, [row.id]: e.target.value as AuthorizationType }))}
                      >
                        <option value="ONE_PURCHASE">One Purchase Only</option>
                        <option value="UNTIL_DATE">Until a Date</option>
                        <option value="UNTIL_REVOKED">Until Revoked (Ongoing)</option>
                      </select>
                      {(durationByRow[row.id] ?? 'ONE_PURCHASE') === 'UNTIL_DATE' && (
                        <input
                          type="date"
                          className={`${input} text-[12px]`}
                          value={expiresByRow[row.id] ?? ''}
                          onChange={(e) => setExpiresByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        />
                      )}
                    </div>
                    <input
                      className={`${input} text-[12px]`}
                      placeholder="Internal review notes (optional)"
                      value={noteByRow[row.id] ?? ''}
                      onChange={(e) => setNoteByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <button onClick={() => confirmApprove(row)} disabled={busyId === row.id} className={`${pillPrimary} px-3 py-1.5 text-[11px]`}>
                      Confirm Approval
                    </button>
                  </div>
                )}

                {panel === 'reject' && (
                  <div className="border border-white/10 rounded-lg p-3 space-y-2">
                    <select
                      className={`${input} text-[12px]`}
                      value={reasonByRow[row.id] ?? ''}
                      onChange={(e) => setReasonByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    >
                      <option value="">Select a reason…</option>
                      {REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <input
                      className={`${input} text-[12px]`}
                      placeholder="Note to customer (optional)"
                      value={noteByRow[row.id] ?? ''}
                      onChange={(e) => setNoteByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <button onClick={() => confirmReject(row)} disabled={busyId === row.id} className={`${pillOutline} px-3 py-1.5 text-[11px]`}>
                      Confirm Rejection
                    </button>
                  </div>
                )}

                {panel === 'more_info' && (
                  <div className="border border-white/10 rounded-lg p-3 space-y-2">
                    <input
                      className={`${input} text-[12px]`}
                      placeholder="What additional info is needed?"
                      value={noteByRow[row.id] ?? ''}
                      onChange={(e) => setNoteByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <button onClick={() => confirmMoreInfo(row)} disabled={busyId === row.id} className={`${pillSecondary} px-3 py-1.5 text-[11px]`}>
                      Send Request
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
