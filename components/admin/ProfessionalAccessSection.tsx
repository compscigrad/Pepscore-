// Admin control for explicit Professional Access pricing eligibility
// (Phase 2B section 4, renamed from SpaEligibilitySection 2026-08-19 --
// Professional Access sprint). Grant/revoke always requires a reason,
// mirroring PortalAccessSection.tsx's pattern for this same customer
// profile page. Audit history is the existing Activity Timeline section --
// PROFESSIONAL_ACCESS_GRANTED/_REVOKED already log there via
// recordCustomerActivity(), nothing new needed to surface it. This is the
// quick manual grant/revoke path; see /admin/professional-access for the
// full application review queue most new grants should go through.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline, input } from '@/components/invoices/theme'

export function ProfessionalAccessSection({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [proEligible, setProEligible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/professional-access`)
      if (res.ok) setProEligible((await res.json()).proEligible)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function toggle(action: 'grant' | 'revoke') {
    if (!reason.trim()) {
      toast.error('A reason is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/professional-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update Professional Access')
      toast.success(action === 'grant' ? 'Professional Access granted' : 'Professional Access revoked')
      setReason('')
      await refresh()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update Professional Access')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`${card} p-6`}>
      <h3 className={sectionHeading}>Professional Pricing</h3>
      <p className={`${mutedText} mb-4`}>
        Controls whether this customer sees Professional Case pricing on the storefront when signed in. Never inferred automatically —
        grant or revoke explicitly, with a reason.
      </p>

      <p className="text-sm mb-4">
        Status:{' '}
        <span className={proEligible ? 'text-green-700 font-semibold' : 'text-gray-500 font-semibold'}>
          {proEligible ? 'Professional Access active' : 'Standard pricing only'}
        </span>
      </p>

      <input
        className={`${input} mb-3`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />

      <div className="flex gap-2">
        {!proEligible ? (
          <button onClick={() => toggle('grant')} disabled={submitting} className={pillPrimary}>
            Grant Professional Access
          </button>
        ) : (
          <button onClick={() => toggle('revoke')} disabled={submitting} className={pillOutline}>
            Revoke Professional Access
          </button>
        )}
      </div>
    </div>
  )
}
