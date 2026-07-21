// Payment history + record-payment form. Only meaningful once an invoice
// has a server id — an unsaved draft has no invoice to attach a payment to,
// so InvoiceBuilder only renders this in edit mode.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney } from '@/lib/invoice/format'
import { card, input, label as labelClass, pillPrimary, sectionHeading, selectOption } from './theme'
import type { InvoicePayment, PaymentMethod } from '@prisma/client'

interface Props {
  invoiceId: string
  payments: InvoicePayment[]
  balanceDue: number
  onPaymentRecorded: () => void
}

const METHODS: PaymentMethod[] = [
  'CASH', 'COD', 'CHECK', 'CASH_APP', 'VENMO', 'APPLE_PAY', 'CREDIT_CARD', 'ACH', 'ZELLE', 'WIRE', 'STRIPE', 'SQUARE', 'CRYPTO', 'OTHER',
]

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
    <div className={`${card} p-6`}>
      <h3 className={`${sectionHeading} mb-4`}>Payments</h3>

      {payments.length > 0 && (
        <div className="mb-5 space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm border-b border-white/10 pb-2">
              <span className="text-white/70">
                {new Date(p.paidAt).toLocaleDateString('en-US', { timeZone: 'UTC' })} · {p.method.replace('_', ' ')}
                {p.referenceNumber ? ` · ${p.referenceNumber}` : ''}
              </span>
              <span className="font-medium text-white">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {balanceDue > 0 ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[100px]">
            <label className={labelClass} htmlFor="paymentAmount">
              Amount
            </label>
            <input
              id="paymentAmount"
              type="number"
              min={0}
              step="0.01"
              className={input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatMoney(balanceDue)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="paymentMethod">
              Method
            </label>
            <select id="paymentMethod" className={input} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m} className={selectOption}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className={labelClass} htmlFor="paymentRef">
              Reference #
            </label>
            <input
              id="paymentRef"
              className={input}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`${pillPrimary} px-5 py-2`}
          >
            Record Payment
          </button>
        </form>
      ) : (
        <p className="text-sm text-green-400 font-medium">Paid in full.</p>
      )}
    </div>
  )
}
