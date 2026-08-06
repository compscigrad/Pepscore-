// Client table for the admin identity-review queue — approve/dismiss
// actions, same fetch+toast+router.refresh() pattern as
// PortalAccessSection.tsx. MULTIPLE_MATCHES cases let the admin pick which
// candidate is correct; ALREADY_LINKED_* cases are dismiss-only (see
// lib/portal/reviewCases.ts's header comment for why).
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline } from '@/components/invoices/theme'

export interface IdentityReviewRow {
  id: string
  reason: 'MULTIPLE_MATCHES' | 'ALREADY_LINKED_OTHER_USER' | 'ALREADY_LINKED_OTHER_CUSTOMER'
  verifiedEmail: string
  createdAt: string
  candidates: { id: string; name: string; email: string | null }[]
}

const REASON_LABEL: Record<IdentityReviewRow['reason'], string> = {
  MULTIPLE_MATCHES: 'Multiple matching customer records',
  ALREADY_LINKED_OTHER_USER: 'Matching customer already linked to a different account',
  ALREADY_LINKED_OTHER_CUSTOMER: 'A customer with this email was linked during sign-up',
}

export function IdentityReviewTable({ initialRows }: { initialRows: IdentityReviewRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  async function act(rowId: string, body: Record<string, unknown>, successMessage: string) {
    setSubmittingId(rowId)
    try {
      const res = await fetch(`/api/admin/identity-review/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update review case')
      toast.success(successMessage)
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review case')
    } finally {
      setSubmittingId(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className={`${card} p-6`}>
        <p className={`text-sm ${mutedText}`}>No identity-review cases waiting — every self-service sign-in resolved cleanly.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.id} className={`${card} p-6 space-y-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className={sectionHeading}>{REASON_LABEL[row.reason]}</h3>
              <p className={`text-sm ${mutedText} mt-1`}>
                {row.verifiedEmail} · flagged {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {row.reason === 'MULTIPLE_MATCHES' && row.candidates.length > 0 ? (
            <div className="space-y-2">
              <p className={`text-sm ${mutedText}`}>Which of these existing customers is the correct match?</p>
              <div className="flex flex-wrap gap-2">
                {row.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${pillPrimary} px-4 py-2`}
                    disabled={submittingId === row.id}
                    onClick={() => act(row.id, { action: 'approve', customerId: c.id }, 'Linked to the selected customer')}
                  >
                    {c.name}
                    {c.email ? ` — ${c.email}` : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={`text-sm ${mutedText}`}>
              To resolve this, use Unlink on the other customer&apos;s Portal Access section first, then have the customer try
              signing in again.
            </p>
          )}

          <button
            type="button"
            className={`${pillOutline} px-4 py-2`}
            disabled={submittingId === row.id}
            onClick={() => act(row.id, { action: 'dismiss' }, 'Review case dismissed')}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
