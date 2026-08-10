// Admin "Online Storefront Orders" list -- search box, filters (status,
// payment method, fulfillment, date range), sortable column headers,
// pagination. Same re-fetch-from-API-on-change pattern as
// components/invoices/InvoiceTable.tsx, so behavior stays correct as order
// volume grows past what's comfortable to ship to the browser at once.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'
import { deriveFulfillmentState, type OrderFulfillmentFilter, type OrderListRow } from '@/lib/orders/admin'
import { card, input, selectOption } from '@/components/invoices/theme'

type SortField = 'orderNumber' | 'customerName' | 'createdAt' | 'total' | 'status'

interface Props {
  initialOrders: OrderListRow[]
  initialTotal: number
}

const STATUS_OPTIONS = ['all', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const
const PAYMENT_METHOD_OPTIONS = ['all', 'CARD', 'ACH', 'APPLE_PAY', 'GOOGLE_PAY', 'CASH_APP', 'PAYPAL', 'VENMO'] as const
const FULFILLMENT_OPTIONS: { value: OrderFulfillmentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unfulfilled', label: 'Unfulfilled' },
  { value: 'partially_fulfilled', label: 'Partially Fulfilled' },
  { value: 'fulfilled', label: 'Fulfilled' },
]

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-white/5 text-white/50',
  PAID: 'bg-green-400/10 text-green-300',
  PROCESSING: 'bg-amber-400/10 text-amber-300',
  SHIPPED: 'bg-blue-400/10 text-blue-300',
  DELIVERED: 'bg-gold/10 text-gold-light',
  CANCELLED: 'bg-red-400/10 text-red-300',
  REFUNDED: 'bg-orange-400/10 text-orange-300',
}

const FULFILLMENT_STYLE: Record<string, string> = {
  NONE: 'bg-white/5 text-white/30',
  UNFULFILLED: 'bg-white/5 text-white/50',
  PARTIALLY_FULFILLED: 'bg-amber-400/10 text-amber-300',
  FULFILLED: 'bg-green-400/10 text-green-300',
}

const FULFILLMENT_LABEL: Record<string, string> = {
  NONE: '—',
  UNFULFILLED: 'Unfulfilled',
  PARTIALLY_FULFILLED: 'Partial',
  FULFILLED: 'Fulfilled',
}

function readableLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function Pill({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ${className}`}>{label}</span>
}

const LIMIT = 25

export function OrderTable({ initialOrders, initialTotal }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [paymentMethod, setPaymentMethod] = useState<string>('all')
  const [fulfillment, setFulfillment] = useState<OrderFulfillmentFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), sortBy, sortDir, status, paymentMethod, fulfillment })
      if (search) params.set('search', search)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/orders?${params.toString()}`)
      const data = await res.json()
      setOrders(data.orders)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, sortDir, search, status, paymentMethod, fulfillment, dateFrom, dateTo])

  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, sortDir, status, paymentMethod, fulfillment, dateFrom, dateTo])

  useEffect(() => {
    if (!hasMounted.current) return
    const timeout = setTimeout(() => {
      setPage(1)
      fetchOrders()
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-6 border-b border-white/10 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading text-[17px] font-bold text-white">Online Storefront Orders</h2>
          <p className="text-[12px] text-white/50">Customer-initiated web checkouts · {total} total</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input className={`${input} max-w-xs`} placeholder="Search order #, customer, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className={selectOption}>
                {s === 'all' ? 'All Statuses' : readableLabel(s)}
              </option>
            ))}
          </select>
          <select className={input} value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }}>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m} value={m} className={selectOption}>
                {m === 'all' ? 'All Payment Methods' : readableLabel(m)}
              </option>
            ))}
          </select>
          <select className={input} value={fulfillment} onChange={(e) => { setFulfillment(e.target.value as OrderFulfillmentFilter); setPage(1) }}>
            {FULFILLMENT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} className={selectOption}>
                {f.label}
              </option>
            ))}
          </select>
          <input type="date" className={input} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} aria-label="From date" />
          <input type="date" className={input} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} aria-label="To date" />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <p className="text-3xl mb-3">📦</p>
          <p>{loading ? 'Loading…' : 'No orders match these filters.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  { key: 'orderNumber', label: 'Order #' },
                  { key: 'createdAt', label: 'Date' },
                  { key: 'customerName', label: 'Customer' },
                  { key: 'status', label: 'Status' },
                  { key: null, label: 'Payment' },
                  { key: null, label: 'Fulfillment' },
                  { key: 'total', label: 'Total' },
                  { key: null, label: 'Invoice' },
                  { key: null, label: '' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap"
                  >
                    {key ? (
                      <button type="button" onClick={() => toggleSort(key as SortField)} className="hover:text-gold transition-colors">
                        {label} {sortBy === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const fulfillmentState = deriveFulfillmentState(order.reservations)
                const latestPayment = order.payments[0]
                return (
                  <tr key={order.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate text-white font-semibold">{order.customerName}</td>
                    <td className="px-4 py-3">
                      <Pill label={readableLabel(order.status)} className={ORDER_STATUS_STYLE[order.status] ?? 'bg-white/5 text-white/50'} />
                    </td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">{latestPayment ? readableLabel(latestPayment.methodType) : '—'}</td>
                    <td className="px-4 py-3">
                      <Pill label={FULFILLMENT_LABEL[fulfillmentState]} className={FULFILLMENT_STYLE[fulfillmentState]} />
                    </td>
                    <td className="px-4 py-3 font-heading font-bold text-white whitespace-nowrap">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {order.invoice ? (
                        <Link href={`/admin/invoices/${order.invoice.id}`} className="text-gold-light hover:underline text-[12px]">
                          {order.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-white/30 text-[12px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/orders/${order.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <p className="text-[12px] text-white/50">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/70 text-[12px] disabled:opacity-30 hover:border-gold/40"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/70 text-[12px] disabled:opacity-30 hover:border-gold/40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
