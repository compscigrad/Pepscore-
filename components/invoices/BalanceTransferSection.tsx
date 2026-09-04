// Balance Carryover (Phase 1B) — move this invoice's remaining balance onto
// another invoice, and view/reverse every transfer this invoice has ever
// been the source or destination of. See lib/balanceTransfers.ts; the
// ledger (BalanceTransfer) is the source of truth, this UI never mutates a
// total directly.
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatMoney, formatMomentDate } from '@/lib/invoice/format'
import { card, input, label as labelClass, pillPrimary, pillOutline, sectionHeading, mutedText } from './theme'
import type { BalanceTransfer } from '@prisma/client'

type TransferOut = BalanceTransfer & { destinationInvoice: { id: string; invoiceNumber: string } }
type TransferIn = BalanceTransfer & { sourceInvoice: { id: string; invoiceNumber: string } }

interface InvoiceSearchResult {
  id: string
  invoiceNumber: string
  customerName: string
  balanceDue: number
}

interface Props {
  invoiceId: string
  balanceDue: number
  transfersOut: TransferOut[]
  transfersIn: TransferIn[]
  onTransferUpdated: () => void
}

export function BalanceTransferSection({ invoiceId, balanceDue, transfersOut, transfersIn, onTransferUpdated }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<InvoiceSearchResult[]>([])
  const [selected, setSelected] = useState<InvoiceSearchResult | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [archiveSource, setArchiveSource] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingReverseId, setConfirmingReverseId] = useState<string | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      if (!search.trim()) {
        setResults([])
        return
      }
      const res = await fetch(`/api/admin/invoices?search=${encodeURIComponent(search)}&limit=6`)
      if (!res.ok) return
      const data = await res.json()
      setResults(
        (data.invoices ?? [])
          .filter((inv: { id: string }) => inv.id !== invoiceId)
          .map((inv: { id: string; invoiceNumber: string; customerName: string; balanceDue: number }) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName,
            balanceDue: inv.balanceDue,
          }))
      )
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [search, invoiceId])

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) {
      toast.error('Select a destination invoice')
      return
    }
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }
    if (numericAmount > balanceDue + 0.005) {
      toast.error(`Amount cannot exceed the remaining balance of ${formatMoney(balanceDue)}`)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/balance-transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationInvoiceId: selected.id,
          amount: numericAmount,
          reason: reason || undefined,
          archiveSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to transfer balance')
      toast.success(`Transferred ${formatMoney(numericAmount)} to ${selected.invoiceNumber}`)
      setShowForm(false)
      setSearch('')
      setSelected(null)
      setAmount('')
      setReason('')
      setArchiveSource(false)
      onTransferUpdated()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer balance')
    } finally {
      setSubmitting(false)
    }
  }

  async function reverse(transferId: string) {
    if (confirmingReverseId !== transferId) {
      setConfirmingReverseId(transferId)
      setTimeout(() => setConfirmingReverseId((cur) => (cur === transferId ? null : cur)), 4000)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/balance-transfers/${transferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reverse transfer')
      toast.success('Transfer reversed')
      onTransferUpdated()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reverse transfer')
    } finally {
      setSubmitting(false)
      setConfirmingReverseId(null)
    }
  }

  if (transfersOut.length === 0 && transfersIn.length === 0 && balanceDue <= 0) return null

  return (
    <div className={`${card} p-6 space-y-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className={sectionHeading}>Balance Transfers</h3>
        {balanceDue > 0 ? (
          <button type="button" className={`${pillOutline} px-4 py-1.5 text-xs`} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Transfer Balance'}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={submitTransfer} className="space-y-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="relative">
            <label className={labelClass} htmlFor="transferSearch">Destination Invoice</label>
            <input
              id="transferSearch"
              className={input}
              value={selected ? `${selected.invoiceNumber} — ${selected.customerName}` : search}
              onChange={(e) => {
                setSelected(null)
                setSearch(e.target.value)
              }}
              placeholder="Search invoice # or customer name…"
            />
            {results.length > 0 && !selected ? (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-dark shadow-lg max-h-56 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                    onClick={() => {
                      setSelected(r)
                      setResults([])
                    }}
                  >
                    {r.invoiceNumber} — {r.customerName}
                    <span className={`${mutedText} ml-2`}>{formatMoney(r.balanceDue)} due</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className={labelClass} htmlFor="transferAmount">Amount</label>
              <input
                id="transferAmount"
                type="number"
                min={0}
                max={balanceDue}
                step="0.01"
                className={`${input} w-32`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={balanceDue.toFixed(2)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={labelClass} htmlFor="transferReason">Reason (optional)</label>
              <input id="transferReason" className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" className="accent-gold" checked={archiveSource} onChange={(e) => setArchiveSource(e.target.checked)} />
            Archive this invoice now that its balance has moved
          </label>
          <button type="submit" className={`${pillPrimary} px-5 py-2`} disabled={submitting}>
            {submitting ? 'Transferring…' : `Transfer ${amount ? formatMoney(Number(amount) || 0) : ''}`}
          </button>
        </form>
      ) : null}

      {transfersOut.length > 0 ? (
        <div className="space-y-2">
          <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>Transferred Out</p>
          {transfersOut.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-white">
                  {formatMoney(t.amount)} → invoice <a href={`/admin/invoices/${t.destinationInvoice.id}`} className="text-gold-light hover:underline">{t.destinationInvoice.invoiceNumber}</a>
                </span>
                <span className={`text-[10px] uppercase tracking-wide ${t.status === 'ACTIVE' ? 'text-gold-light' : 'text-white/40'}`}>
                  {t.status === 'ACTIVE' ? 'Active' : 'Reversed'}
                </span>
              </div>
              <p className={`${mutedText} text-xs mt-1`}>
                {formatMomentDate(t.transferredAt)}{t.reason ? ` — ${t.reason}` : ''}
              </p>
              {t.status === 'REVERSED' ? (
                <p className={`${mutedText} text-xs`}>Reversed {formatMomentDate(t.reversedAt)}{t.reversalReason ? ` — ${t.reversalReason}` : ''}</p>
              ) : (
                <button
                  type="button"
                  className={`mt-2 ${pillOutline} px-3 py-1 text-xs ${confirmingReverseId === t.id ? 'border-red-400/40 text-red-300' : ''}`}
                  onClick={() => reverse(t.id)}
                  disabled={submitting}
                >
                  {confirmingReverseId === t.id ? 'Confirm Reverse' : 'Reverse'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {transfersIn.length > 0 ? (
        <div className="space-y-2">
          <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${mutedText}`}>Transferred In</p>
          {transfersIn.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-white">
                  {formatMoney(t.amount)} ← invoice <a href={`/admin/invoices/${t.sourceInvoice.id}`} className="text-gold-light hover:underline">{t.sourceInvoice.invoiceNumber}</a>
                </span>
                <span className={`text-[10px] uppercase tracking-wide ${t.status === 'ACTIVE' ? 'text-gold-light' : 'text-white/40'}`}>
                  {t.status === 'ACTIVE' ? 'Active' : 'Reversed'}
                </span>
              </div>
              <p className={`${mutedText} text-xs mt-1`}>
                {formatMomentDate(t.transferredAt)}{t.reason ? ` — ${t.reason}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
