'use client'

// Download links for the two generated PDF variants, plus a manual
// "Email Invoice to Customer" action — always sends/resends the Client
// Invoice PDF regardless of whether the one-time auto-send on first ISSUED
// already fired (see lib/invoiceIssuedEmail.tsx).
//
// Two distinct outline-pill styles (gold-tinted for the internal record,
// neutral for the customer copy) rather than the old solid bg-dark button —
// a near-black fill was nearly invisible against this page's black
// background.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { pillOutline } from './theme'

export function PDFExportButtons({ invoiceId, customerEmail }: { invoiceId: string; customerEmail?: string | null }) {
  const [sending, setSending] = useState(false)

  async function emailInvoice() {
    setSending(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invoice email')
      toast.success(`Invoice emailed to ${customerEmail}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invoice email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=master`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-gold/30 bg-gold/10 text-gold-light text-sm font-bold px-5 py-2.5 hover:bg-gold/15 transition-colors"
      >
        Download Master Invoice
      </a>
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=recipient`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/15 bg-white/5 text-white/70 text-sm font-bold px-5 py-2.5 hover:bg-white/10 transition-colors"
      >
        Download Client Invoice
      </a>
      <button
        type="button"
        onClick={emailInvoice}
        disabled={sending || !customerEmail}
        title={customerEmail ? undefined : 'No customer email on file'}
        className={`${pillOutline} px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {sending ? 'Sending...' : 'Email Invoice to Customer'}
      </button>
    </div>
  )
}
