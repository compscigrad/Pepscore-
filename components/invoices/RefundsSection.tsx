// Standalone refund/account-credit workflow — independent of backorders and
// independent of Shippo/Stripe/any payment provider. Shows the full ledger
// (lib/refunds.ts's listRefundsForInvoice: every InvoiceRefund and
// CustomerAccountCredit tied to this invoice, whatever created them) and
// lets an admin request a new one. Completing/failing a refund reuses the
// exact same PATCH /refunds/[refundId] endpoint BackordersSection already
// uses — one completion path regardless of which flow created the refund.
//
// Wording is deliberately literal about what has and hasn't happened:
// "requested" / "pending" for a refund that hasn't been completed, only
// "completed" once an admin explicitly confirms it, and "issued" for
// account credit (which is real store credit granted immediately, not a
// pending external-money-movement obligation).
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption, mutedText } from './theme'

type RefundStatus = 'PENDING' | 'AWAITING_MANUAL_PROCESSING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type Disposition = 'REFUND' | 'ACCOUNT_CREDIT' | 'COMBINATION'

interface RefundLedgerEntry {
  kind: 'REFUND'
  id: string
  requestedAmount: number
  completedAmount: number | null
  status: RefundStatus
  reason: string
  method: string | null
  providerTransactionId: string | null
  requestedAt: string
  completedAt: string | null
  failureReason: string | null
  origin: 'STANDALONE' | 'BACKORDER'
}

interface AccountCreditLedgerEntry {
  kind: 'ACCOUNT_CREDIT'
  id: string
  amount: number
  remainingAmount: number
  reason: string
  issuedAt: string
  origin: 'STANDALONE' | 'BACKORDER'
}

type LedgerEntry = RefundLedgerEntry | AccountCreditLedgerEntry

interface Props {
  invoiceId: string
  hasCustomer: boolean
}

const REFUND_TERMINAL: RefundStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'PAYPAL', 'BANK_TRANSFER', 'STRIPE'] as const

export function RefundsSection({ invoiceId, hasCustomer }: Props) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [disposition, setDisposition] = useState<Disposition>('REFUND')
  const [amount, setAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState('')

  const [providerTxnId, setProviderTxnId] = useState<Record<string, string>>({})
  const [failureReason, setFailureReason] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/refunds`)
      if (res.ok) setLedger(await res.json())
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    const refundAmount = disposition !== 'ACCOUNT_CREDIT' ? parseFloat(amount) : undefined
    const accountCreditAmount = disposition !== 'REFUND' ? parseFloat(creditAmount) : undefined
    if (!reason.trim()) {
      toast.error('A reason is required')
      return
    }
    if (!((refundAmount ?? 0) > 0 || (accountCreditAmount ?? 0) > 0)) {
      toast.error('Enter a refund amount, an account credit amount, or both')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundAmount,
          accountCreditAmount,
          reason: reason.trim(),
          method: method || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to request refund')
      toast.success('Refund/credit requested — customer notified')
      setAmount('')
      setCreditAmount('')
      setReason('')
      setMethod('')
      setDisposition('REFUND')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request refund')
    } finally {
      setSubmitting(false)
    }
  }

  async function refundAction(refundId: string, body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/refunds/${refundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update refund')
      toast.success(successMessage)
      setProviderTxnId((prev) => ({ ...prev, [refundId]: '' }))
      setFailureReason((prev) => ({ ...prev, [refundId]: '' }))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update refund')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`${card} p-6 space-y-6`}>
      <h3 className={sectionHeading}>Refunds &amp; Account Credit</h3>

      {ledger.length > 0 ? (
        <div className="space-y-3">
          {ledger.map((entry) =>
            entry.kind === 'REFUND' ? (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-white">
                    Refund — requested {formatMoney(entry.requestedAmount)}
                    {entry.completedAmount != null ? `, completed ${formatMoney(entry.completedAmount)}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.origin === 'BACKORDER' ? (
                      <span className={`text-[10px] uppercase tracking-wide ${mutedText}`}>Backorder</span>
                    ) : null}
                    <StatusBadge status={entry.status} variant="refund" />
                  </div>
                </div>
                <p className={`text-xs ${mutedText}`}>{entry.reason} — requested {formatDate(entry.requestedAt)}</p>
                {entry.status === 'COMPLETED' ? (
                  <p className={`text-xs ${mutedText}`}>
                    Completed {formatDate(entry.completedAt)}
                    {entry.method ? ` via ${entry.method}` : ''}
                    {entry.providerTransactionId ? ` — ref ${entry.providerTransactionId}` : ''}
                  </p>
                ) : null}
                {entry.status === 'FAILED' && entry.failureReason ? (
                  <p className="text-xs text-red-300">Failed: {entry.failureReason}</p>
                ) : null}
                {!REFUND_TERMINAL.includes(entry.status) ? (
                  <>
                    <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-white/5">
                      <div>
                        <label className={labelClass} htmlFor={`txn-${entry.id}`}>Provider Txn ID (optional)</label>
                        <input
                          id={`txn-${entry.id}`}
                          className={`${input} w-40`}
                          value={providerTxnId[entry.id] ?? ''}
                          onChange={(e) => setProviderTxnId((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                          placeholder="e.g. terminal receipt #"
                        />
                      </div>
                      <button
                        type="button"
                        className={`${pillPrimary} px-4 py-2`}
                        disabled={submitting}
                        onClick={() =>
                          refundAction(
                            entry.id,
                            { action: 'complete', providerTransactionId: providerTxnId[entry.id] || undefined },
                            'Refund marked completed — customer notified'
                          )
                        }
                      >
                        Mark Refund Completed
                      </button>
                      <div>
                        <label className={labelClass} htmlFor={`fail-${entry.id}`}>Failure Reason</label>
                        <input
                          id={`fail-${entry.id}`}
                          className={`${input} w-40`}
                          value={failureReason[entry.id] ?? ''}
                          onChange={(e) => setFailureReason((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                          placeholder="If it can't be completed"
                        />
                      </div>
                      <button
                        type="button"
                        className={`${pillOutline} px-4 py-2`}
                        disabled={submitting || !failureReason[entry.id]}
                        onClick={() => refundAction(entry.id, { action: 'fail', failureReason: failureReason[entry.id] }, 'Refund marked failed')}
                      >
                        Mark Failed
                      </button>
                      <button
                        type="button"
                        className={`${pillOutline} px-4 py-2`}
                        disabled={submitting}
                        onClick={() => refundAction(entry.id, { action: 'cancel' }, 'Refund cancelled')}
                      >
                        Cancel
                      </button>
                    </div>
                    <p className={`text-xs ${mutedText}`}>
                      No money has been recorded as returned until this refund is marked Completed — the customer has
                      not been told it&apos;s finished yet.
                    </p>
                  </>
                ) : null}
              </div>
            ) : (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-white">
                    Account credit issued — {formatMoney(entry.amount)}
                    {entry.remainingAmount !== entry.amount ? ` (${formatMoney(entry.remainingAmount)} remaining)` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.origin === 'BACKORDER' ? (
                      <span className={`text-[10px] uppercase tracking-wide ${mutedText}`}>Backorder</span>
                    ) : null}
                    <StatusBadge status="COMPLETED" variant="refund" />
                  </div>
                </div>
                <p className={`text-xs ${mutedText}`}>{entry.reason} — issued {formatDate(entry.issuedAt)}</p>
              </div>
            )
          )}
        </div>
      ) : (
        <p className={`text-sm ${mutedText}`}>No refunds or account credit on this invoice.</p>
      )}

      <form onSubmit={submitRequest} className="pt-4 border-t border-white/5 space-y-3">
        <div>
          <label className={labelClass} htmlFor="disposition">Disposition</label>
          <select
            id="disposition"
            className={`${input} w-56`}
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
          >
            <option value="REFUND" className={selectOption}>Refund (cash back)</option>
            <option value="ACCOUNT_CREDIT" className={selectOption} disabled={!hasCustomer}>Account Credit</option>
            <option value="COMBINATION" className={selectOption} disabled={!hasCustomer}>Combination</option>
          </select>
          {!hasCustomer ? (
            <p className={`text-xs mt-1 ${mutedText}`}>
              This invoice has no linked customer — account credit needs a customer to attach to, so only a cash
              refund is available here.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {disposition !== 'ACCOUNT_CREDIT' ? (
            <div>
              <label className={labelClass} htmlFor="refundAmount">Refund Amount</label>
              <input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0"
                className={`${input} w-32`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          ) : null}
          {disposition !== 'REFUND' ? (
            <div>
              <label className={labelClass} htmlFor="creditAmount">Account Credit Amount</label>
              <input
                id="creditAmount"
                type="number"
                step="0.01"
                min="0"
                className={`${input} w-32`}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
          ) : null}
          {disposition !== 'ACCOUNT_CREDIT' ? (
            <div>
              <label className={labelClass} htmlFor="method">Method (optional)</label>
              <select id="method" className={`${input} w-40`} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="" className={selectOption}>Not specified</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className={selectOption}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex-1 min-w-[200px]">
            <label className={labelClass} htmlFor="reason">Reason</label>
            <input id="reason" className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer cancelled before shipment" />
          </div>
          <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={submitting}>
            Request
          </button>
        </div>
        <p className={`text-xs ${mutedText}`}>
          A refund is created Pending — nothing is recorded as returned, and the customer is told only that it&apos;s
          been requested, until an admin marks it Completed above. Account credit is issued immediately since it is
          Pepscore&apos;s own store credit, not money moved through an outside provider.
        </p>
      </form>
    </div>
  )
}
