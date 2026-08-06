'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

const label = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5'
const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30'

interface InvoiceOption {
  id: string
  invoiceNumber: string
}

export function PortalSupportForm({ invoices }: { invoices: InvoiceOption[] }) {
  const [invoiceId, setInvoiceId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/account/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, invoiceId: invoiceId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit your request')
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit your request')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-white font-bold mb-1">Message Sent</p>
        <p className="text-white/60 text-sm">We&apos;ll get back to you shortly. A confirmation was sent to your email.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-4">
      {invoices.length > 0 ? (
        <div>
          <label className={label} htmlFor="invoiceId">Related Invoice (optional)</label>
          <select id="invoiceId" className={input} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Not related to a specific invoice</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className={label} htmlFor="message">How can we help?</label>
        <textarea
          id="message"
          className={`${input} min-h-[140px] resize-y`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's going on…"
        />
      </div>
      <button type="submit" disabled={submitting || message.trim().length < 5} className="w-full rounded-full bg-gold text-dark font-bold text-sm py-2.5 disabled:opacity-50">
        {submitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
