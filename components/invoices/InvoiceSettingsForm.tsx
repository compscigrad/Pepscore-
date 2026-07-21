'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, pillPrimary, sectionHeading } from './theme'

interface Props {
  initialArchiveAfterDays: number | null
}

// null represents "Never archive" — kept as its own radio value ('never')
// in the UI since HTML radio inputs need a string value, translated back to
// null right before it's sent to the API.
const OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30 Days (Default)' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
  { value: 'never', label: 'Never Archive' },
]

export function InvoiceSettingsForm({ initialArchiveAfterDays }: Props) {
  const [selected, setSelected] = useState(
    initialArchiveAfterDays === null ? 'never' : String(initialArchiveAfterDays)
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const archiveAfterDays = selected === 'never' ? null : Number(selected)
      const res = await fetch('/api/admin/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveAfterDays }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('Invoice settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-lg`}>
      <h2 className={`${sectionHeading} mb-1`}>Automatically archive paid invoices after:</h2>
      <p className="text-white/50 text-sm mb-4">
        Once an invoice is fully paid, it stays in the active list for this many days before moving
        to Archived automatically. Editing an invoice, reversing a payment, or reopening it resets
        the countdown.
      </p>
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
            <input
              type="radio"
              name="archiveAfterDays"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="accent-gold"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`${pillPrimary} px-6 py-2.5 mt-6`}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
