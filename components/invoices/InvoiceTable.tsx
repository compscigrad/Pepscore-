// Dashboard invoice list — search box, sortable column headers, status
// filter, pagination. Re-fetches from /api/admin/invoices on any change
// rather than filtering client-side, so behavior stays correct as invoice
// volume grows past what's comfortable to ship to the browser at once.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'
import { formatCarrierLabel } from '@/lib/invoice/format'
import { StatusBadge } from './StatusBadge'
import { card, input, pillPrimary, selectOption } from './theme'
import type { InvoiceWithRelations, InvoiceListFilter } from '@/lib/invoices'

type SortField = 'invoiceNumber' | 'customerName' | 'createdAt' | 'balanceDue' | 'status'

interface Props {
  initialInvoices: InvoiceWithRelations[]
  initialTotal: number
}

// Replaces the old raw-InvoiceStatus dropdown — these map to
// lib/invoices.ts's buildFilterClause, not 1:1 to the InvoiceStatus enum
// (e.g. "Outstanding" spans several statuses with balanceDue > 0).
const FILTERS: { value: InvoiceListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'archived', label: 'Archived' },
]

const LIMIT = 25

export function InvoiceTable({ initialInvoices, initialTotal }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<InvoiceListFilter>('all')
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        sortBy,
        sortDir,
        filter,
      })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/invoices?${params.toString()}`)
      const data = await res.json()
      setInvoices(data.invoices)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, sortDir, search, filter])

  // Skip the redundant fetch on first mount — the server component already
  // supplied initialInvoices/initialTotal for that render. A ref (not state)
  // because flipping this shouldn't itself trigger a re-render.
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, sortDir, filter])

  // Debounce free-text search so every keystroke doesn't trigger a fetch.
  useEffect(() => {
    if (!hasMounted.current) return
    const timeout = setTimeout(() => {
      setPage(1)
      fetchInvoices()
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const columns: { field: SortField; label: string }[] = [
    { field: 'invoiceNumber', label: 'Invoice #' },
    { field: 'customerName', label: 'Customer' },
    { field: 'createdAt', label: 'Date' },
    { field: 'balanceDue', label: 'Balance' },
    { field: 'status', label: 'Status' },
  ]

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="font-heading text-[17px] font-bold text-white">
          {filter === 'archived' ? 'Archived Invoices' : 'Active Invoices'}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, invoice #, tracking, email..."
            className={`${input} sm:w-72`}
            aria-label="Search invoices"
          />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as InvoiceListFilter)
              setPage(1)
            }}
            className={input}
            aria-label="Filter invoices"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value} className={selectOption}>
                {f.label}
              </option>
            ))}
          </select>
          <Link
            href="/admin/invoices/new"
            className={`${pillPrimary} px-6 py-2.5 text-center`}
          >
            + New Invoice
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 cursor-pointer select-none whitespace-nowrap"
                >
                  {col.label} {sortBy === col.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">
                Carrier / Tracking
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/50 text-sm">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-white/70">{invoice.customerName}</td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {new Date(invoice.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {formatCurrency(invoice.balanceDue)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {invoice.carrier ? `${formatCarrierLabel(invoice.carrier)} — ${invoice.trackingNumber ?? 'pending'}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/invoices/${invoice.id}`} className="text-gold-light font-bold text-sm hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 text-sm text-white/50">
        <span>
          Page {page} of {totalPages} · {total} invoice{total === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-full border border-white/15 disabled:opacity-40 hover:bg-white/5 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-full border border-white/15 disabled:opacity-40 hover:bg-white/5 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
