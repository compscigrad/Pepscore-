// Standalone refund/account-credit workflow — independent of backorders and
// independent of Shippo/Stripe/any payment provider. Shows the full ledger
// (lib/refunds.ts's listRefundsForInvoice: every InvoiceRefund and
// CustomerAccountCredit tied to this invoice, whatever created them) and
// lets an admin request a new one — either a whole-invoice refund/account
// credit, or one-or-more individual line items (2026-08-14 item-level
// refund sprint). Completing/failing a refund reuses the exact same PATCH
// /refunds/[refundId] endpoint BackordersSection already uses — one
// completion path regardless of which flow or shape created the refund.
//
// Wording is deliberately literal about what has and hasn't happened:
// "requested" / "pending" for a refund that hasn't been completed, only
// "completed" once an admin explicitly confirms it, and "issued" for
// account credit (which is real store credit granted immediately, not a
// pending external-money-movement obligation).
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney, formatMomentDate } from '@/lib/invoice/format'
import { allocateInvoiceDiscount, remainingRefundableForItem, quantityRefundAmount } from '@/lib/invoice/refundAllocation'
import { StatusBadge } from './StatusBadge'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, selectOption, mutedText } from './theme'

type RefundStatus = 'PENDING' | 'AWAITING_MANUAL_PROCESSING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type Disposition = 'REFUND' | 'ACCOUNT_CREDIT' | 'COMBINATION'
type RefundMode = 'INVOICE' | 'LINE_ITEMS'

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
  // Present only on item-level refunds (invoiceItemId non-null server-side).
  invoiceItemId?: string | null
  refundedQuantity?: number | null
  grossItemValue?: number | null
  allocatedDiscount?: number | null
  effectivePaidValue?: number | null
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

// Non-terminal (and COMPLETED) refunds still "claim" money against an
// item/invoice even before COMPLETED -- matches lib/refunds.ts's own
// NON_TERMINAL_REFUND_STATUSES so this component's "remaining refundable"
// display can never show more room than the server would actually allow.
const CLAIMS_BUDGET: RefundStatus[] = ['PENDING', 'AWAITING_MANUAL_PROCESSING', 'PROCESSING', 'COMPLETED']

export interface RefundableInvoiceItem {
  id: string
  name: string
  size?: string | null
  quantity: number
  total: number
}

interface Props {
  invoiceId: string
  hasCustomer: boolean
  items: RefundableInvoiceItem[]
  /** Sum of this invoice's InvoiceDiscount.appliedAmount rows. */
  invoiceDiscountTotal: number
}

const REFUND_TERMINAL: RefundStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'PAYPAL', 'BANK_TRANSFER', 'STRIPE'] as const

export function RefundsSection({ invoiceId, hasCustomer, items, invoiceDiscountTotal }: Props) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [mode, setMode] = useState<RefundMode>('INVOICE')

  // Whole-invoice fields
  const [disposition, setDisposition] = useState<Disposition>('REFUND')
  const [amount, setAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')

  // Line-item fields
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({})

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

  // Same proportional allocation the server uses (lib/invoice/
  // refundAllocation.ts, imported directly -- it's pure, no server-only
  // dependency, so it's safe in this client bundle) -- this is a display
  // preview only; the server independently recomputes and enforces it at
  // request time, so a stale client-side view can never under- or
  // over-refund, only show a momentarily-stale number until refresh().
  const allocations = useMemo(
    () => new Map(allocateInvoiceDiscount(items, invoiceDiscountTotal).map((a) => [a.itemId, a])),
    [items, invoiceDiscountTotal]
  )

  // Already-claimed amount per item, from the live ledger.
  const claimedByItemId = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of ledger) {
      if (entry.kind !== 'REFUND' || !entry.invoiceItemId) continue
      if (!CLAIMS_BUDGET.includes(entry.status)) continue
      const amt = entry.status === 'COMPLETED' ? entry.completedAmount ?? entry.requestedAmount : entry.requestedAmount
      map.set(entry.invoiceItemId, (map.get(entry.invoiceItemId) ?? 0) + amt)
    }
    return map
  }, [ledger])

  const itemRows = useMemo(
    () =>
      items.map((item) => {
        const allocation = allocations.get(item.id)
        const effectivePaidValue = allocation?.effectivePaidValue ?? item.total
        const remaining = remainingRefundableForItem(effectivePaidValue, claimedByItemId.has(item.id) ? [claimedByItemId.get(item.id)!] : [])
        return { item, allocation, effectivePaidValue, remaining }
      }),
    [items, allocations, claimedByItemId]
  )

  const selectedTotal = useMemo(() => {
    let sum = 0
    for (const id of selectedItemIds) {
      const row = itemRows.find((r) => r.item.id === id)
      if (!row) continue
      const qty = refundQuantities[id] ?? row.item.quantity
      sum += qty === row.item.quantity ? row.remaining : Math.min(quantityRefundAmount(row.effectivePaidValue, row.item.quantity, qty), row.remaining)
    }
    return sum
  }, [selectedItemIds, refundQuantities, itemRows])

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function submitWholeInvoiceRequest(e: React.FormEvent) {
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

  async function submitLineItemRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error('A reason is required')
      return
    }
    if (selectedItemIds.size === 0) {
      toast.error('Select at least one line item to refund')
      return
    }

    const lineItems = Array.from(selectedItemIds).map((id) => {
      const row = itemRows.find((r) => r.item.id === id)!
      const qty = refundQuantities[id] ?? row.item.quantity
      return qty === row.item.quantity ? { invoiceItemId: id } : { invoiceItemId: id, quantity: qty }
    })

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems, reason: reason.trim(), method: method || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to request refund')
      toast.success(`${lineItems.length} line-item refund${lineItems.length === 1 ? '' : 's'} requested — customer notified`)
      setSelectedItemIds(new Set())
      setRefundQuantities({})
      setReason('')
      setMethod('')
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
                    {entry.invoiceItemId ? (
                      <span className={`ml-2 text-[10px] uppercase tracking-wide ${mutedText}`}>
                        Line item{entry.refundedQuantity ? ` · qty ${entry.refundedQuantity}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.origin === 'BACKORDER' ? (
                      <span className={`text-[10px] uppercase tracking-wide ${mutedText}`}>Backorder</span>
                    ) : null}
                    <StatusBadge status={entry.status} variant="refund" />
                  </div>
                </div>
                {entry.invoiceItemId && entry.grossItemValue != null ? (
                  <p className={`text-xs ${mutedText}`}>
                    Gross {formatMoney(entry.grossItemValue)} − allocated discount {formatMoney(entry.allocatedDiscount ?? 0)} = effective paid{' '}
                    {formatMoney(entry.effectivePaidValue ?? entry.grossItemValue)}
                  </p>
                ) : null}
                <p className={`text-xs ${mutedText}`}>{entry.reason} — requested {formatMomentDate(entry.requestedAt)}</p>
                {entry.status === 'COMPLETED' ? (
                  <p className={`text-xs ${mutedText}`}>
                    Completed {formatMomentDate(entry.completedAt)}
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
                <p className={`text-xs ${mutedText}`}>{entry.reason} — issued {formatMomentDate(entry.issuedAt)}</p>
              </div>
            )
          )}
        </div>
      ) : (
        <p className={`text-sm ${mutedText}`}>No refunds or account credit on this invoice.</p>
      )}

      <div className="pt-4 border-t border-white/5 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('INVOICE')}
            className={`${mode === 'INVOICE' ? pillPrimary : pillOutline} px-4 py-2 text-xs`}
          >
            Full Invoice
          </button>
          <button
            type="button"
            onClick={() => setMode('LINE_ITEMS')}
            disabled={items.length === 0}
            className={`${mode === 'LINE_ITEMS' ? pillPrimary : pillOutline} px-4 py-2 text-xs`}
          >
            Select Line Items
          </button>
        </div>

        {mode === 'INVOICE' ? (
          <form onSubmit={submitWholeInvoiceRequest} className="space-y-3">
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
          </form>
        ) : (
          <form onSubmit={submitLineItemRequest} className="space-y-3">
            <div className="space-y-2">
              {itemRows.map(({ item, remaining }) => {
                const fullyRefunded = remaining <= 0
                const checked = selectedItemIds.has(item.id)
                const qty = refundQuantities[item.id] ?? item.quantity
                return (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                      fullyRefunded ? 'border-white/5 opacity-50' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={fullyRefunded}
                        onChange={(e) => toggleItem(item.id, e.target.checked)}
                        className="w-4 h-4 accent-gold"
                      />
                      <span>
                        <span className="block text-sm text-white">
                          {item.name}
                          {item.size ? ` — ${item.size}` : ''} — Qty {item.quantity}
                        </span>
                        <span className={`block text-xs ${mutedText}`}>
                          {fullyRefunded ? 'Fully Refunded' : `Remaining refundable value ${formatMoney(remaining)}`}
                        </span>
                      </span>
                    </span>
                    {checked && item.quantity > 1 ? (
                      <span className="flex items-center gap-1.5">
                        <label className={`text-xs ${mutedText}`} htmlFor={`qty-${item.id}`}>Qty to refund</label>
                        <input
                          id={`qty-${item.id}`}
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={qty}
                          onChange={(e) =>
                            setRefundQuantities((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value, 10) || 1)) }))
                          }
                          className={`${input} w-16`}
                        />
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={labelClass} htmlFor="lineItemMethod">Method (optional)</label>
                <select id="lineItemMethod" className={`${input} w-40`} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="" className={selectOption}>Not specified</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m} className={selectOption}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={labelClass} htmlFor="lineItemReason">Reason</label>
                <input
                  id="lineItemReason"
                  className={input}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Product B arrived damaged"
                />
              </div>
              <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={submitting || selectedItemIds.size === 0}>
                Refund {selectedItemIds.size > 0 ? formatMoney(selectedTotal) : 'Selected'}
              </button>
            </div>
          </form>
        )}

        <p className={`text-xs ${mutedText}`}>
          A refund is created Pending — nothing is recorded as returned, and the customer is told only that it&apos;s
          been requested, until an admin marks it Completed above. Account credit is issued immediately since it is
          Pepscore Lab&apos;s own store credit, not money moved through an outside provider. Line-item refund amounts
          are this invoice&apos;s own stored price minus its proportional share of any invoice-level discount — never
          recomputed from current catalog pricing.
        </p>
      </div>
    </div>
  )
}
