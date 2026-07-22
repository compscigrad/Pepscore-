'use client'
// Settings > Admin Notifications — the missing piece the audit flagged:
// lib/notifications/dispatch.ts has real email/SMS channels, but until a
// recipient exists here, nothing ever gets delivered. Managed entirely
// through this UI; no email/phone is ever hardcoded in code.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, input, label as labelClass, pillOutline, pillPrimary, sectionHeading, mutedText } from './theme'

interface Recipient {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  emailEnabled: boolean
  smsEnabled: boolean
}

interface Props {
  initialRecipients: Recipient[]
  suggestedEmail: string
}

export function NotificationRecipientsForm({ initialRecipients, suggestedEmail }: Props) {
  const [recipients, setRecipients] = useState(initialRecipients)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() && !phone.trim()) {
      toast.error('Enter an email or phone number')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          emailEnabled: !!email,
          smsEnabled: !!phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add recipient')
      setRecipients((prev) => [...prev, data])
      setName('')
      setEmail('')
      setPhone('')
      toast.success('Recipient added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add recipient')
    } finally {
      setSaving(false)
    }
  }

  async function toggleChannel(id: string, channel: 'emailEnabled' | 'smsEnabled', value: boolean) {
    const previous = recipients
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, [channel]: value } : r)))
    try {
      const res = await fetch(`/api/admin/notification-settings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [channel]: value }),
      })
      if (!res.ok) throw new Error('Failed to update recipient')
    } catch (err) {
      setRecipients(previous)
      toast.error(err instanceof Error ? err.message : 'Failed to update recipient')
    }
  }

  async function removeRecipient(id: string) {
    const previous = recipients
    setRecipients((prev) => prev.filter((r) => r.id !== id))
    try {
      const res = await fetch(`/api/admin/notification-settings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove recipient')
      toast.success('Recipient removed')
    } catch (err) {
      setRecipients(previous)
      toast.error(err instanceof Error ? err.message : 'Failed to remove recipient')
    }
  }

  return (
    <div className={`${card} p-6 max-w-2xl`}>
      <h2 className={`${sectionHeading} mb-1`}>Admin Notifications</h2>
      <p className={`text-sm ${mutedText} mb-4`}>
        Who gets notified when a customer submits an intake form. Add at least one recipient — nothing is
        delivered until one exists here.
      </p>

      {recipients.length > 0 ? (
        <div className="space-y-2 mb-5">
          {recipients.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm"
            >
              <div>
                <span className="text-white font-medium">{r.name || r.email || r.phone}</span>
                <span className={`${mutedText} ml-2`}>
                  {[r.email, r.phone].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.emailEnabled}
                    disabled={!r.email}
                    onChange={(e) => toggleChannel(r.id, 'emailEnabled', e.target.checked)}
                    className="accent-gold"
                  />
                  Email
                </label>
                <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.smsEnabled}
                    disabled={!r.phone}
                    onChange={(e) => toggleChannel(r.id, 'smsEnabled', e.target.checked)}
                    className="accent-gold"
                  />
                  SMS
                </label>
                <button type="button" className="text-xs text-red-300 hover:underline" onClick={() => removeRecipient(r.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${mutedText} mb-5`}>
          No recipients configured yet — intake submissions currently notify no one.
        </p>
      )}

      <form onSubmit={addRecipient} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[120px]">
          <label className={labelClass} htmlFor="recipientName">Name (optional)</label>
          <input id="recipientName" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. You" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className={labelClass} htmlFor="recipientEmail">Email</label>
          <input
            id="recipientEmail"
            type="email"
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={suggestedEmail}
          />
        </div>
        <div className="min-w-[160px]">
          <label className={labelClass} htmlFor="recipientPhone">Phone (optional)</label>
          <input id="recipientPhone" type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="For SMS" />
        </div>
        <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={saving}>
          {saving ? 'Adding...' : 'Add Recipient'}
        </button>
      </form>
      {recipients.length === 0 ? (
        <button
          type="button"
          className={`${pillOutline} px-4 py-1.5 mt-3 text-xs`}
          onClick={() => setEmail(suggestedEmail)}
        >
          Use {suggestedEmail}
        </button>
      ) : null}
    </div>
  )
}
