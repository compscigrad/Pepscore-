'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, pillOutline, pillPrimary, sectionHeading, mutedText, input as inputClass } from './theme'
import { getIntakeLinkState } from '@/lib/intakeLinkState'
import type { IntakeLink } from '@prisma/client'

interface Props {
  invoiceId: string
  intakeLinks: IntakeLink[]
  onLinkUpdated: () => void
}

const STATE_LABEL: Record<string, string> = {
  ACTIVE: 'Active — not yet viewed',
  VIEWED: 'Viewed, not yet submitted',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
  INVALIDATED: 'Invalidated',
  ATTEMPT_LIMIT_REACHED: 'Attempt limit reached',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export function IntakeLinkSection({ invoiceId, intakeLinks, onLinkUpdated }: Props) {
  const [busy, setBusy] = useState(false)
  const [confirmingInvalidate, setConfirmingInvalidate] = useState(false)

  // intakeLinks is already ordered newest-first by lib/invoices.ts.
  const current = intakeLinks[0] ?? null
  const state = current ? getIntakeLinkState(current) : null
  const url = current ? `${APP_URL}/intake/${current.token}` : null
  const isTerminal = state === 'EXPIRED' || state === 'INVALIDATED' || state === 'ATTEMPT_LIMIT_REACHED'

  async function generate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/intake-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate intake link')
      toast.success(data.reused ? 'Reusing the existing active link' : 'Intake link generated')
      onLinkUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate intake link')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy — select and copy the link manually')
    }
  }

  async function regenerate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/intake-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to regenerate the link')
      toast.success('New intake link generated — the old one no longer works')
      onLinkUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate the link')
    } finally {
      setBusy(false)
    }
  }

  async function invalidate() {
    if (!confirmingInvalidate) {
      setConfirmingInvalidate(true)
      setTimeout(() => setConfirmingInvalidate(false), 4000)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/intake-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to invalidate the link')
      toast.success('Intake link invalidated')
      onLinkUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invalidate the link')
    } finally {
      setBusy(false)
      setConfirmingInvalidate(false)
    }
  }

  return (
    <div className={`${card} p-6`}>
      <h2 className={`${sectionHeading} mb-1`}>Request Customer Information</h2>
      <p className={`${mutedText} text-sm mb-4`}>
        Send the client a secure link to fill in their own contact, billing, and shipping details.
      </p>

      {!current || isTerminal ? (
        <button type="button" onClick={generate} disabled={busy} className={`${pillPrimary} px-6 py-2.5`}>
          {busy ? 'Generating...' : current ? 'Generate New Link' : 'Generate Intake Link'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={mutedText}>Status:</span>
            <span className="text-white">{state ? STATE_LABEL[state] : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={url ?? ''} className={`${inputClass} flex-1`} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copyLink} className={`${pillOutline} px-4 py-2 whitespace-nowrap`}>
              Copy Link
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={regenerate} disabled={busy} className={`${pillOutline} px-4 py-2`}>
              Regenerate
            </button>
            <button
              type="button"
              onClick={invalidate}
              disabled={busy}
              className={`${pillOutline} px-4 py-2 ${confirmingInvalidate ? 'border-red-400/40 text-red-300' : ''}`}
            >
              {confirmingInvalidate ? 'Click again to confirm' : 'Invalidate Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
