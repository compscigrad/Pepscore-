// Payment history + record-payment form. Only meaningful once an invoice
// has a server id — an unsaved draft has no invoice to attach a payment to,
// so InvoiceBuilder only renders this in edit mode.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney } from '@/lib/invoice/format'
import type { InvoicePayment, PaymentMethod } from '@prisma/client'

interface Props {
  invoiceId: string
  payments: InvoicePayment[]
  balanceDue: number
  onPaymentRecorded: () => void
}

const METHODS: PaymentMethod[] = [
  'CASH', 'CREDIT_CARD', 'STRIPE', 'SQUARE', 'CASH_APP', 'VENMO', 'ZELLE', 'ACH', 'WIRE', 'CHECK', 'CRYPTO', 'OTHER',
]

const inputClass = 'w-full rounded-lg border border-g300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40'

export function PaymentSection({ invoiceId, payments, balanceDue, onPaymentRecorded }: Props) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Enter a payment amount greater than zero')
      return
    }
    if (numericAmount > balanceDue + 0.005) {
      toast.error(`Payment exceeds the remaining balance of ${formatMoney(balanceDue)}`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, method, referenceNumber: referenceNumber || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to record payment')
      toast.success('Payment recorded')
      setAmount('')
      setReferenceNumber('')
      onPaymentRecorded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sh">
      <h3 className="font-heading text-[15px] font-bold text-dark mb-4">Payments</h3>

      {payments.length > 0 && (
        <div className="mb-5 space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm border-b border-g100 pb-2">
              <span className="text-g700">
                {new Date(p.paidAt).toLocaleDateString('en-US', { timeZone: 'UTC' })} · {p.method.replace('_', ' ')}
                {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
              </span>
              <span className="font-medium text-dark">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {balanceDue > 0 ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[100px]">
            <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5" htmlFor="paymentAmount">
              Amount
            </label>
            <input
              id="paymentAmount"
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatMoney(balanceDue)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5" htmlFor="paymentMethod">
              Method
            </label>
            <select id="paymentMethod" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5" htmlFor="paymentRef">
              Reference #
            </label>
            <input
              id="paymentRef"
              className={inputClass}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-gold text-white text-sm font-bold px-5 py-2 hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            Record Payment
          </button>
        </form>
      ) : (
        <p className="text-sm text-green-600 font-medium">Paid in full.</p>
      )}
    </div>
  )
}
