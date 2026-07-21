// Installment-plan setup and display. Available on any invoice with a
// balance left to schedule — whether or not anything has been paid yet, so
// it can be set up proactively "just in case it needs to be utilized," not
// only once an invoice happens to already be Partial. Once an arrangement
// exists, its schedule stays visible regardless of status (including after
// it's fully paid off), since it's a permanent record worth keeping visible.
'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { generateInstallmentSchedule, addDaysUTC, frequencyIntervalDays } from '@/lib/invoice/paymentArrangement'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, sectionHeading, selectOption } from './theme'
import type { PaymentArrangement, PaymentArrangementInstallment, PaymentFrequency, InvoicePayment } from '@prisma/client'

type ArrangementWithInstallments = PaymentArrangement & { installments: PaymentArrangementInstallment[] }

interface Props {
  invoiceId: string
  arrangement: ArrangementWithInstallments | null
  canCreate: boolean
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  payments: InvoicePayment[]
  onArrangementCreated: () => void
}

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  WEEKLY: 'Every Week',
  BIWEEKLY: 'Every Two Weeks',
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PaymentArrangementSection({
  invoiceId,
  arrangement,
  canCreate,
  invoiceTotal,
  amountPaid,
  balanceDue,
  payments,
  onArrangementCreated,
}: Props) {
  const [creating, setCreating] = useState(false)
  const [numberOfPayments, setNumberOfPayments] = useState('3')
  const [frequency, setFrequency] = useState<PaymentFrequency>('BIWEEKLY')
  const [startDate, setStartDate] = useState(todayInputValue())
  const [submitting, setSubmitting] = useState(false)

  const hasExistingPayment = amountPaid > 0

  // What the server will treat as "installment #1" — the earliest payment
  // on record, if there is one. Computed the same way
  // lib/paymentArrangements.ts does, so this preview never disagrees with
  // what actually gets saved.
  const earliestPaymentDate =
    hasExistingPayment && payments.length > 0
      ? [...payments].sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())[0].paidAt
      : null

  const previewSchedule = useMemo(() => {
    const count = Number(numberOfPayments)
    if (!count || count < 1) return []

    const intervalDays = frequencyIntervalDays(frequency)
    const firstDueDate = hasExistingPayment
      ? addDaysUTC(new Date(earliestPaymentDate!), intervalDays)
      : new Date(startDate)

    return generateInstallmentSchedule({
      firstDueDate,
      totalAmount: balanceDue,
      numberOfPayments: count,
      frequency,
      startInstallmentNumber: hasExistingPayment ? 2 : 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfPayments, frequency, balanceDue, startDate, hasExistingPayment])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const count = Number(numberOfPayments)
    if (!count || count < 1) {
      toast.error('Enter at least one payment')
      return
    }
    if (!hasExistingPayment && !startDate) {
      toast.error('Choose a start date')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/payment-arrangement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numberOfPayments: count,
          frequency,
          startDate: hasExistingPayment ? undefined : startDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to set up payment arrangement')
      toast.success('Payment arrangement created')
      setCreating(false)
      onArrangementCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set up payment arrangement')
    } finally {
      setSubmitting(false)
    }
  }

  if (!arrangement && !canCreate) return null

  const nextDue = arrangement?.installments.find((i) => i.status === 'PENDING')

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={sectionHeading}>Payment Arrangement</h3>
        {!arrangement && canCreate && !creating ? (
          <button type="button" onClick={() => setCreating(true)} className={`${pillPrimary} px-4 py-1.5`}>
            + Set Up Payment Arrangement
          </button>
        ) : null}
      </div>

      {arrangement ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
            <SummaryStat label="Original Invoice Total" value={formatMoney(invoiceTotal)} />
            <SummaryStat label="Payments Received" value={formatMoney(amountPaid)} />
            <SummaryStat label="Remaining Balance" value={formatMoney(balanceDue)} accent={balanceDue > 0} />
            <SummaryStat label="Next Payment Due" value={nextDue ? formatDate(nextDue.dueDate) : '—'} />
            <SummaryStat label="Payment Frequency" value={FREQUENCY_LABELS[arrangement.frequency]} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Payment #</th>
                  <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Due Date</th>
                  <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 text-right">Amount</th>
                  <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {arrangement.installments.map((inst) => (
                  <tr key={inst.id} className="border-b border-white/10">
                    <td className="py-2 text-white">Payment {inst.installmentNumber}</td>
                    <td className="py-2 text-white/70">{formatDate(inst.dueDate)}</td>
                    <td className="py-2 text-right text-white">{formatMoney(inst.amount)}</td>
                    <td className="py-2 text-right">
                      <StatusBadge status={inst.status} variant="payment" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : creating ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {hasExistingPayment ? (
              <>
                <div>
                  <p className={labelClass}>Initial Payment Amount</p>
                  <p className="text-sm text-white/70 py-2">{formatMoney(amountPaid)}</p>
                </div>
                <div>
                  <p className={labelClass}>Initial Payment Date</p>
                  <p className="text-sm text-white/70 py-2">{formatDate(earliestPaymentDate)}</p>
                </div>
              </>
            ) : (
              <div>
                <label className={labelClass} htmlFor="arrangementStartDate">Start Date</label>
                <input
                  id="arrangementStartDate"
                  type="date"
                  className={input}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            )}
            <div>
              <p className={labelClass}>Remaining Balance</p>
              <p className="text-sm text-white/70 py-2">{formatMoney(balanceDue)}</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="numberOfPayments">Number of Remaining Payments</label>
              <input
                id="numberOfPayments"
                type="number"
                min={1}
                className={input}
                value={numberOfPayments}
                onChange={(e) => setNumberOfPayments(e.target.value)}
              />
            </div>
          </div>

          <div className="max-w-xs">
            <label className={labelClass} htmlFor="frequency">Payment Frequency</label>
            <select
              id="frequency"
              className={input}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
            >
              <option value="WEEKLY" className={selectOption}>Every Week</option>
              <option value="BIWEEKLY" className={selectOption}>Every Two Weeks</option>
            </select>
          </div>

          {previewSchedule.length > 0 ? (
            <div>
              <p className={`${labelClass} mb-2`}>Generated Schedule Preview</p>
              <div className="space-y-1">
                {previewSchedule.map((s) => (
                  <div key={s.installmentNumber} className="flex justify-between text-sm">
                    <span className="text-white/70">Payment {s.installmentNumber} — {formatDate(s.dueDate)}</span>
                    <span className="text-white">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className={`${pillPrimary} px-5 py-2`}>
              {submitting ? 'Saving...' : 'Save Arrangement'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${accent ? 'text-gold-light' : 'text-white'}`}>{value}</p>
    </div>
  )
}
