'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, pillPrimary, sectionHeading } from './theme'

interface Props {
  initialEnabled: boolean
}

export function PaymentReceivedEmailSettingsForm({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoEmailPaymentReceived: enabled }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('Payment email settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-lg`}>
      <h2 className={`${sectionHeading} mb-1`}>Automatic payment-received emails</h2>
      <p className="text-white/50 text-sm mb-4">
        Every time a payment is recorded on an invoice, automatically email the customer a
        confirmation with the updated invoice PDF attached.
      </p>
      <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-gold"
        />
        Automatically email customers when a payment is received
      </label>
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
