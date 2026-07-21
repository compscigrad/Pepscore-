// Dashboard invoice list — search box, sortable column headers, status
// filter, pagination. Re-fetches from /api/admin/invoices on any change
// rather than filtering client-side, so behavior stays correct as invoice
// volume grows past what's comfortable to ship to the browser at once.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'
import { StatusBadge } from './StatusBadge'
import type { InvoiceWithRelations } from '@/lib/invoices'

type SortField = 'invoiceNumber' | 'customerName' | 'createdAt' | 'balanceDue' | 'status'

interface Props {
  initialInvoices: InvoiceWithRelations[]
  initialTotal: number
}

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const LIMIT = 25

export function InvoiceTable({ initialInvoices, initialTotal }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
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
      })
      if (search) params.set('search', search)
      if (status) params.set('status', status)

      const res = await fetch(`/api/admin/invoices?${params.toString()}`)
      const data = await res.json()
      setInvoices(data.invoices)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, sortDir, search, status])

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
  }, [page, sortBy, sortDir, status])

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
    <div className="bg-white rounded-2xl shadow-sh overflow-hidden">
      <div className="p-6 border-b border-g100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="font-heading text-[17px] font-bold text-dark">All Invoices</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, invoice #, tracking, email..."
            className="rounded-lg border border-g300 px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-gold/40"
            aria-label="Search invoices"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-g300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Link
            href="/admin/invoices/new"
            className="rounded-full bg-gold text-white text-sm font-bold px-6 py-2.5 text-center hover:bg-gold-dark transition-colors"
          >
            + New Invoice
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-g100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 cursor-pointer select-none whitespace-nowrap"
                >
                  {col.label} {sortBy === col.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500">
                Carrier / Tracking
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-g500 text-sm">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-g100 hover:bg-g100/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-dark whitespace-nowrap">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-g700">{invoice.customerName}</td>
                  <td className="px-4 py-3 text-g500 whitespace-nowrap">
                    {new Date(invoice.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-dark whitespace-nowrap">
                    {formatCurrency(invoice.balanceDue)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-g500 whitespace-nowrap">
                    {invoice.carrier ? `${invoice.carrier} — ${invoice.trackingNumber ?? 'pending'}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/invoices/${invoice.id}`} className="text-gold-dark font-bold text-sm hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-g100 text-sm text-g500">
        <span>
          Page {page} of {totalPages} · {total} invoice{total === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-full border border-g300 disabled:opacity-40 hover:bg-g100 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-full border border-g300 disabled:opacity-40 hover:bg-g100 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
