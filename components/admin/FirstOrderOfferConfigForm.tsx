'use client'

// Settings > FIRST10 -- the master on/off switch only. Percentage,
// eligibility, expiration, and stackability now live on the active
// default first-order PromotionCampaign at Admin -> Promotions
// (/admin/promotions) instead of here -- see docs/Decisions.md.
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { card, pillPrimary, sectionHeading, mutedText } from '@/components/invoices/theme'

export interface FirstOrderOfferConfigFormProps {
  initial: {
    enabled: boolean
  }
}

export function FirstOrderOfferConfigForm({ initial }: FirstOrderOfferConfigFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/promotions/first-order-offer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save settings')
      toast.success('First-order offer settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-xl space-y-5`}>
      <div>
        <h2 className={`${sectionHeading} mb-1`}>FIRST10 — master switch</h2>
        <p className={`text-sm ${mutedText}`}>
          Off by default — turning this on, together with an active default first-order campaign at{' '}
          <Link href="/admin/promotions" className="text-gold hover:text-gold-light underline">
            Admin → Promotions
          </Link>
          , is what makes the offer visible on the storefront. The offer&rsquo;s discount amount, copy, eligibility,
          and expiration are configured there now, not on this page.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-gold" />
        Offer is live on the storefront
      </label>

      <button type="button" onClick={save} disabled={saving} className={`${pillPrimary} px-6 py-2.5`}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
