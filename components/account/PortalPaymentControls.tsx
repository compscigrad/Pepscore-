// Embeddable payment-selection / payment-arrangement controls for the
// portal's invoice detail page — the same interaction logic and submit
// endpoints' underlying service functions as components/intake/
// IssuedInvoiceView.tsx (which owns the full-page intake-link version of
// this), extracted so the portal page's own richer invoice detail layout
// doesn't end up with two competing invoice summaries. There is still only
// one place these two actions are actually implemented server-side —
// lib/invoices.ts's submitPayInFullSelection/submitPaymentArrangementRequest
// — this component only decides what to render and where to POST.
'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { recommendInstallmentCount } from '@/lib/invoice/status'
import { generateInstallmentSchedule, addDaysUTC, frequencyIntervalDays, type PaymentFrequency } from '@/lib/invoice/paymentArrangement'
import { formatMoney } from '@/lib/invoice/format'

const label = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5'
const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30'

const PAY_METHODS = [
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'CASH_APP', label: 'Cash App' },
  { value: 'VENMO', label: 'Venmo' },
  { value: 'APPLE_PAY', label: 'Apple Pay' },
  { value: 'ACH', label: 'Bank transfer (ACH)' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'DEBIT_CARD', label: 'Debit card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'WIRE', label: 'Wire transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'OTHER', label: 'Other' },
] as const

interface Installment {
  id: string
  installmentNumber: number
  dueDate: string
  amount: number
  status: string
}

export interface PortalPaymentControlsProps {
  invoiceId: string
  balanceDue: number
  paymentIntentStatus: string
  selectedPaymentMethod: string | null
  arrangement: { status: string; frequency: PaymentFrequency; denialReason: string | null; installments: Installment[] } | null
}

export function PortalPaymentControls(props: PortalPaymentControlsProps) {
  const [mode, setMode] = useState<'full' | 'arrangement'>('full')
  const [method, setMethod] = useState('')
  const [frequency, setFrequency] = useState<PaymentFrequency>('BIWEEKLY')
  const [downPayment, setDownPayment] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState<'full' | 'arrangement' | null>(null)

  const balanceToSchedule = useMemo(() => {
    const dp = Number(downPayment) || 0
    return Math.max(Math.round((props.balanceDue - dp) * 100) / 100, 0)
  }, [downPayment, props.balanceDue])

  const recommendedCount = recommendInstallmentCount(balanceToSchedule)

  const previewSchedule = useMemo(() => {
    if (recommendedCount < 1) return []
    const intervalDays = frequencyIntervalDays(frequency)
    return generateInstallmentSchedule({
      firstDueDate: addDaysUTC(new Date(), intervalDays),
      totalAmount: balanceToSchedule,
      numberOfPayments: recommendedCount,
      frequency,
      startInstallmentNumber: 1,
    })
  }, [frequency, balanceToSchedule, recommendedCount])

  async function submitPayInFull(e: React.FormEvent) {
    e.preventDefault()
    if (!method) {
      toast.error('Select a payment method')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/account/invoices/${props.invoiceId}/payment-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong — please try again.')
      setJustSubmitted('full')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitArrangementRequest(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/account/invoices/${props.invoiceId}/payment-arrangement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency, proposedDownPayment: Number(downPayment) || 0 }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong — please try again.')
      setJustSubmitted('arrangement')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (props.balanceDue <= 0) return null

  if (justSubmitted === 'full') {
    return <ConfirmationCard title="Payment Selection Received">We received your Pay in Full selection. Our team will manually verify your payment and follow up shortly — this does not mean payment has been received yet.</ConfirmationCard>
  }
  if (justSubmitted === 'arrangement') {
    return <ConfirmationCard title="Arrangement Request Received">We received your payment-arrangement request. It&apos;s now awaiting review — we&apos;ll email you as soon as it&apos;s approved or if we need to follow up.</ConfirmationCard>
  }
  if (props.paymentIntentStatus === 'ARRANGEMENT_APPROVAL_PENDING') {
    return <ConfirmationCard title="Arrangement Request Under Review">Your payment-arrangement request is awaiting review. We&apos;ll email you as soon as it&apos;s approved or if we need to follow up.</ConfirmationCard>
  }
  if (props.paymentIntentStatus === 'ARRANGEMENT_APPROVED' && props.arrangement) {
    return (
      <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6">
        <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-gold mb-3">Approved Payment Arrangement</p>
        <div className="space-y-1.5">
          {props.arrangement.installments.map((inst) => (
            <div key={inst.id} className="flex justify-between text-sm">
              <span className="text-white/70">
                Payment {inst.installmentNumber} — {new Date(inst.dueDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
              </span>
              <span className={inst.status === 'PAID' ? 'text-gold' : 'text-white'}>
                {formatMoney(inst.amount)} {inst.status === 'PAID' ? '· Paid' : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="text-white/40 text-xs mt-4">Payments will be recorded here after they are manually verified.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6">
      {props.paymentIntentStatus === 'AWAITING_MANUAL_CONFIRMATION' ? (
        <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-white/70">
          We already have your <strong className="text-white">{props.selectedPaymentMethod}</strong> selection on file
          and are verifying it. You can update your selection below if needed.
        </div>
      ) : null}
      {props.paymentIntentStatus === 'ARRANGEMENT_DENIED' ? (
        <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-white/70">
          Your previous arrangement request wasn&apos;t approved as submitted
          {props.arrangement?.denialReason ? `: ${props.arrangement.denialReason}` : '.'} Choose Pay in Full or submit a
          revised request below.
        </div>
      ) : null}

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMode('full')}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${mode === 'full' ? 'bg-gold text-dark' : 'bg-white/5 text-white/60'}`}
        >
          Pay in Full
        </button>
        <button
          type="button"
          onClick={() => setMode('arrangement')}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${mode === 'arrangement' ? 'bg-gold text-dark' : 'bg-white/5 text-white/60'}`}
        >
          Request a Payment Arrangement
        </button>
      </div>

      {mode === 'full' ? (
        <form onSubmit={submitPayInFull} className="space-y-4">
          <p className="text-white/50 text-xs leading-relaxed">
            This means you intend to pay the remaining balance in one payment — it does not mean payment has been
            received.
          </p>
          <div>
            <label className={label} htmlFor="method">Payment Method</label>
            <select id="method" className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Select a method</option>
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded-full bg-gold text-dark font-bold text-sm py-2.5 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Payment Selection'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitArrangementRequest} className="space-y-4">
          <p className="text-white/50 text-xs leading-relaxed">
            Propose a schedule below. This is a request only — it&apos;s subject to PepScore Lab&apos;s approval and is
            never active or finalized until approved.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="frequency">Frequency</label>
              <select id="frequency" className={input} value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}>
                <option value="WEEKLY">Every Week</option>
                <option value="BIWEEKLY">Every Two Weeks</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="downPayment">Immediate Down Payment (optional)</label>
              <input
                id="downPayment"
                type="number"
                min={0}
                max={props.balanceDue}
                step="0.01"
                className={input}
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
              />
            </div>
          </div>

          {previewSchedule.length > 0 ? (
            <div>
              <p className={`${label} mb-2`}>Recommended Schedule (subject to approval)</p>
              <div className="space-y-1">
                {previewSchedule.map((s) => (
                  <div key={s.installmentNumber} className="flex justify-between text-sm">
                    <span className="text-white/70">
                      Payment {s.installmentNumber} — {s.dueDate.toLocaleDateString('en-US', { timeZone: 'UTC' })}
                    </span>
                    <span className="text-white">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button type="submit" disabled={submitting} className="w-full rounded-full bg-gold text-dark font-bold text-sm py-2.5 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Payment Arrangement Request'}
          </button>
        </form>
      )}
    </div>
  )
}

function ConfirmationCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-white font-bold mb-1">{title}</p>
      <p className="text-white/60 text-sm leading-relaxed">{children}</p>
    </div>
  )
}
