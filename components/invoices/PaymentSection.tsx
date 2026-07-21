// Payment history + record-payment form. Only meaningful once an invoice
// has a server id — an unsaved draft has no invoice to attach a payment to,
// so InvoiceBuilder only renders this in edit mode.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatPaymentMethodLabel } from '@/lib/invoice/format'
import { computePaymentStatus } from '@/lib/invoice/paymentArrangement'
import { StatusBadge } from './StatusBadge'
import { PaymentArrangementSection } from './PaymentArrangementSection'
import { card, input, label as labelClass, pillPrimary, sectionHeading, selectOption } from './theme'
import type { InvoicePayment, PaymentArrangement, PaymentArrangementInstallment, PaymentMethod } from '@prisma/client'

interface Props {
  invoiceId: string
  payments: InvoicePayment[]
  amountPaid: number
  total: number
  balanceDue: number
  paymentArrangement: (PaymentArrangement & { installments: PaymentArrangementInstallment[] }) | null
  onPaymentRecorded: () => void
}

// NA first and default — an invoice that hasn't been paid yet shouldn't
// default to a specific real method like Cash. Existing methods not in the
// spec's list (COD, Apple Pay, Stripe, Square, Crypto) are kept at the end
// rather than removed — the spec asks for these "at minimum."
const METHODS: PaymentMethod[] = [
  'NA', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'ACH', 'BANK_TRANSFER', 'WIRE', 'ZELLE',
  'CASH_APP', 'VENMO', 'PAYPAL', 'CHECK', 'OTHER', 'COD', 'APPLE_PAY', 'STRIPE', 'SQUARE', 'CRYPTO',
]

export function PaymentSection({
  invoiceId,
  payments,
  amountPaid,
  total,
  balanceDue,
  paymentArrangement,
  onPaymentRecorded,
}: Props) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('NA')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const paymentStatus = computePaymentStatus(amountPaid, total)

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
    if (method === 'NA') {
      toast.error('Select a payment method')
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
      setMethod('NA')
      onPaymentRecorded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={sectionHeading}>Payments</h3>
          <StatusBadge status={paymentStatus} variant="payment" />
        </div>

        {payments.length > 0 && (
          <div className="mb-5 space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-white/70">
                  {new Date(p.paidAt).toLocaleDateString('en-US', { timeZone: 'UTC' })} · {formatPaymentMethodLabel(p.method)}
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
                  <option key={m} value={m} className={selectOption}>{formatPaymentMethodLabel(m)}</option>
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

      <PaymentArrangementSection
        invoiceId={invoiceId}
        arrangement={paymentArrangement}
        canCreate={balanceDue > 0 && !paymentArrangement}
        invoiceTotal={total}
        amountPaid={amountPaid}
        balanceDue={balanceDue}
        payments={payments}
        onArrangementCreated={onPaymentRecorded}
      />
    </div>
  )
}
