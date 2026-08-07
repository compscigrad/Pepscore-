// Admin control for explicit SPA/wholesale storefront pricing eligibility
// (Phase 2B section 4). Grant/revoke always requires a reason, mirroring
// PortalAccessSection.tsx's pattern for this same customer profile page.
// Audit history is the existing Activity Timeline section --
// SPA_ELIGIBILITY_GRANTED/_REVOKED already log there via
// recordCustomerActivity(), nothing new needed to surface it.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline, input } from '@/components/invoices/theme'

export function SpaEligibilitySection({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [spaEligible, setSpaEligible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/spa-eligibility`)
      if (res.ok) setSpaEligible((await res.json()).spaEligible)
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
      const res = await fetch(`/api/admin/customers/${customerId}/spa-eligibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update SPA eligibility')
      toast.success(action === 'grant' ? 'SPA pricing eligibility granted' : 'SPA pricing eligibility revoked')
      setReason('')
      await refresh()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update SPA eligibility')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`${card} p-6`}>
      <h3 className={sectionHeading}>SPA / Wholesale Pricing</h3>
      <p className={`${mutedText} mb-4`}>
        Controls whether this customer sees SPA case pricing on the storefront when signed in. Never inferred automatically —
        grant or revoke explicitly, with a reason.
      </p>

      <p className="text-sm mb-4">
        Status:{' '}
        <span className={spaEligible ? 'text-green-700 font-semibold' : 'text-gray-500 font-semibold'}>
          {spaEligible ? 'Eligible for SPA pricing' : 'Standard pricing only'}
        </span>
      </p>

      <input
        className={`${input} mb-3`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />

      <div className="flex gap-2">
        {!spaEligible ? (
          <button onClick={() => toggle('grant')} disabled={submitting} className={pillPrimary}>
            Grant SPA Eligibility
          </button>
        ) : (
          <button onClick={() => toggle('revoke')} disabled={submitting} className={pillOutline}>
            Revoke SPA Eligibility
          </button>
        )}
      </div>
    </div>
  )
}
