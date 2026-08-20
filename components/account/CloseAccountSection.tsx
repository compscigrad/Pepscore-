// Customer-initiated account closure UI (2026-08-20). Deliberately
// non-prominent (bottom of Profile, quiet styling) but not hidden -- no
// manipulative cancellation friction, just one deliberate confirmation step
// so it can't be triggered by an accidental click.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'

type Step = 'idle' | 'confirming' | 'closed'

export function CloseAccountSection() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null)

  async function confirmClose() {
    if (confirmText.trim().toUpperCase() !== 'CLOSE MY ACCOUNT') {
      setError('Type CLOSE MY ACCOUNT exactly to confirm.')
      return
    }
    setSubmitting(true)
    setError(null)
    setOutstandingBalance(null)
    try {
      const res = await fetch('/api/account/close', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (typeof data.outstandingBalance === 'number') setOutstandingBalance(data.outstandingBalance)
        throw new Error(data.error || 'Failed to close account')
      }
      setStep('closed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close account')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'closed') {
    return (
      <div className={`${card} p-6`}>
        <h3 className={sectionHeading}>Account Closed</h3>
        <p className={mutedText}>
          Your account has been closed. No further action is needed. If this was accidental or you need assistance,
          contact us.
        </p>
      </div>
    )
  }

  return (
    <div className={`${card} p-6`}>
      <h3 className={sectionHeading}>Close Account</h3>
      <p className={`${mutedText} mb-3`}>
        Closing your account ends your access immediately. Historical transaction records Pepscore is permitted or
        required to retain are not necessarily erased. Outstanding orders/payments remain governed by existing
        policy.
      </p>

      {step === 'idle' && (
        <button
          onClick={() => setStep('confirming')}
          className="text-[12px] font-heading font-bold uppercase tracking-[0.05em] text-red-300 hover:text-red-200 underline underline-offset-2"
        >
          Close My Account
        </button>
      )}

      {step === 'confirming' && (
        <div className="space-y-2">
          {outstandingBalance != null ? (
            <div className="text-[13px] text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-lg px-3 py-2">
              Your account currently has an outstanding balance of ${outstandingBalance.toFixed(2)}. Please resolve
              the balance before closing your account.{' '}
              <Link href="/account/invoices" className="underline">View Invoices</Link> ·{' '}
              <a href="mailto:contact@pepscorelab.com" className="underline">Contact Pepscore</a>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-white">This will:</p>
              <ul className="list-disc list-inside text-[13px] text-white/70 space-y-0.5">
                <li>End your account access immediately</li>
                <li>Sign out any active sessions where supported</li>
                <li>Make account-specific features unavailable</li>
              </ul>
              <label className="block text-[11px] font-heading font-bold uppercase tracking-[0.06em] text-white/50 mt-3 mb-1">
                Type CLOSE MY ACCOUNT to confirm
              </label>
              <input
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CLOSE MY ACCOUNT"
              />
            </>
          )}
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            {outstandingBalance == null && (
              <button
                onClick={confirmClose}
                disabled={submitting}
                className="px-4 py-2 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/25 text-[12px] font-heading font-bold uppercase tracking-[0.05em] disabled:opacity-50"
              >
                {submitting ? 'Closing…' : 'Confirm Closure'}
              </button>
            )}
            <button
              onClick={() => { setStep('idle'); setError(null); setOutstandingBalance(null); setConfirmText('') }}
              className="px-4 py-2 rounded-full border border-white/15 text-white/60 hover:text-white text-[12px] font-heading font-bold uppercase tracking-[0.05em]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
