'use client'

// Settings > FIRST10 -- admin control for the storefront first-order offer.
// `enabled` defaults off; nothing here is visible on the storefront until an
// admin explicitly saves it on (components/storefront/Footer.tsx reads this
// same config server-side).
import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, input as inputClass, label as labelClass, pillPrimary, sectionHeading, mutedText } from '@/components/invoices/theme'

export interface FirstOrderOfferConfigFormProps {
  initial: {
    enabled: boolean
    percentage: number
    eligibleProductSlugs: string[]
    expiresAt: string | null
    stackable: boolean
  }
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function FirstOrderOfferConfigForm({ initial }: FirstOrderOfferConfigFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [percentage, setPercentage] = useState(String(initial.percentage))
  const [slugs, setSlugs] = useState(initial.eligibleProductSlugs.join(', '))
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(initial.expiresAt))
  const [stackable, setStackable] = useState(initial.stackable)
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsedPercentage = Number(percentage)
    if (!Number.isFinite(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
      toast.error('Percentage must be greater than 0 and no more than 100.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/promotions/first-order-offer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          percentage: parsedPercentage,
          eligibleProductSlugs: slugs.split(',').map((s) => s.trim()).filter(Boolean),
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`).toISOString() : null,
          stackable,
        }),
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
        <h2 className={`${sectionHeading} mb-1`}>FIRST10 — first-order offer</h2>
        <p className={`text-sm ${mutedText}`}>
          Shown as a banner in the site footer and claimed via email + phone. Off by default — turning
          this on is the one action that makes the offer visible to visitors.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-gold" />
        Offer is live on the storefront
      </label>

      <div>
        <label className={labelClass}>Discount percentage</label>
        <input
          type="number"
          min={1}
          max={100}
          step="0.1"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          className={`${inputClass} max-w-[140px]`}
        />
      </div>

      <div>
        <label className={labelClass}>Eligible product slugs (comma-separated, blank = all products)</label>
        <input
          type="text"
          value={slugs}
          onChange={(e) => setSlugs(e.target.value)}
          placeholder="e.g. semaglutide-5mg, tirzepatide-10mg"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Expires (optional)</label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={`${inputClass} max-w-[200px]`}
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
        <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} className="accent-gold" />
        Stackable with other discounts
      </label>

      <button type="button" onClick={save} disabled={saving} className={`${pillPrimary} px-6 py-2.5`}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
