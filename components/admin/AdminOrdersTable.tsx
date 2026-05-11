// Admin orders table with shipping label creation and status management
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/orders'

interface OrderItem {
  id: string
  name: string
  size: string
  quantity: number
  unitPrice: number
  costOfGoods: number
  total: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  fulfillmentStatus: string
  total: number
  subtotal: number
  shippingCost: number
  stripeFee: number
  createdAt: Date | string
  items: OrderItem[]
  invoice: { invoiceNumber: string } | null
  shippingLabel: { trackingNumber: string; carrier: string; labelUrl: string } | null
}

interface Props {
  orders: Order[]
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  REFUNDED: 'bg-orange-100 text-orange-600',
}

export function AdminOrdersTable({ orders: initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingLabelId, setLoadingLabelId] = useState<string | null>(null)
  const [rates, setRates] = useState<Record<string, { object_id: string; provider: string; servicelevel: { name: string }; amount: string; estimated_days: number }[]>>({})

  async function fetchRates(orderId: string) {
    try {
      const res = await fetch(`/api/shipping/labels?orderId=${orderId}`)
      const data = await res.json()
      setRates(prev => ({ ...prev, [orderId]: data.rates ?? [] }))
    } catch {
      toast.error('Failed to fetch shipping rates')
    }
  }

  async function createLabel(orderId: string, rateObjectId: string) {
    setLoadingLabelId(orderId)
    try {
      const res = await fetch('/api/shipping/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, rateObjectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Label created — ${data.trackingNumber}`)
      // Update local state
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, fulfillmentStatus: 'FULFILLED', status: 'SHIPPED', shippingLabel: { trackingNumber: data.trackingNumber, carrier: data.carrier, labelUrl: data.labelUrl } }
          : o
      ))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Label creation failed'
      toast.error(msg)
    } finally {
      setLoadingLabelId(null)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-g100">
            {['Order #','Date','Customer','Status','Fulfillment','Total','Invoice','Tracking','Actions'].map(h => (
              <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const cogs = order.items.reduce((s, i) => s + i.costOfGoods, 0)
            const grossProfit = order.subtotal - cogs
            const netProfit = grossProfit - order.stripeFee - order.shippingCost
            const isExpanded = expandedId === order.id

            return (
              <>
                <tr
                  key={order.id}
                  className="border-b border-g100 hover:bg-g100/50 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <td className="px-4 py-3 font-heading font-bold text-dark">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-g500 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-dark">{order.customerName}</p>
                    <p className="text-[11px] text-g500">{order.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-heading text-[10px] font-bold tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-heading text-[10px] font-bold tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${order.fulfillmentStatus === 'FULFILLED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {order.fulfillmentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-heading font-bold text-dark">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-g700 font-mono text-[11px]">{order.invoice?.invoiceNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    {order.shippingLabel ? (
                      <span className="text-[11px] font-mono text-purple-700">{order.shippingLabel.trackingNumber}</span>
                    ) : (
                      <span className="text-g300 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.shippingLabel ? (
                      <a
                        href={order.shippingLabel.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] font-heading font-bold text-gold hover:text-gold-dark"
                      >
                        Download Label
                      </a>
                    ) : order.status === 'PAID' || order.status === 'PROCESSING' ? (
                      <button
                        onClick={e => { e.stopPropagation(); fetchRates(order.id); setExpandedId(order.id) }}
                        className="text-[11px] font-heading font-bold text-blue-600 hover:text-blue-800"
                      >
                        Create Label
                      </button>
                    ) : null}
                  </td>
                </tr>

                {/* Expanded row — profit breakdown + rate selection */}
                {isExpanded && (
                  <tr key={`${order.id}-expanded`} className="bg-g100/70">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Profit metrics */}
                        <div>
                          <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-3">Profit Breakdown</p>
                          <div className="space-y-1.5 text-[13px]">
                            {[
                              ['Subtotal', formatCurrency(order.subtotal)],
                              ['COGS', `-${formatCurrency(cogs)}`],
                              ['Gross Profit', formatCurrency(grossProfit), 'font-bold'],
                              ['Shipping Cost', `-${formatCurrency(order.shippingCost)}`],
                              ['Stripe Fee', `-${formatCurrency(order.stripeFee)}`],
                              ['Net Profit', formatCurrency(netProfit), 'font-bold text-gold-dark'],
                            ].map(([label, value, cls]) => (
                              <div key={label as string} className="flex justify-between">
                                <span className="text-g700">{label}</span>
                                <span className={cls as string ?? ''}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Shipping rate selection (if label not yet created) */}
                        {!order.shippingLabel && (
                          <div>
                            <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-3">Shipping Rates</p>
                            {rates[order.id] ? (
                              rates[order.id].length === 0 ? (
                                <p className="text-[13px] text-g500">No rates available for this address.</p>
                              ) : (
                                <div className="space-y-2">
                                  {rates[order.id].map(rate => (
                                    <div key={rate.object_id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-g100">
                                      <div>
                                        <p className="font-heading text-[13px] font-bold">{rate.provider} — {rate.servicelevel.name}</p>
                                        <p className="text-[11px] text-g500">{rate.estimated_days} business day{rate.estimated_days !== 1 ? 's' : ''}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="font-heading font-bold text-dark">${rate.amount}</span>
                                        <button
                                          onClick={() => createLabel(order.id, rate.object_id)}
                                          disabled={loadingLabelId === order.id}
                                          className="bg-gold hover:bg-gold-dark disabled:opacity-50 text-white font-heading text-[11px] font-bold tracking-[0.06em] uppercase px-3 py-1.5 rounded transition-colors"
                                        >
                                          {loadingLabelId === order.id ? 'Purchasing…' : 'Buy Label'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => fetchRates(order.id)}
                                className="text-[12px] font-heading font-bold text-blue-600 hover:text-blue-800"
                              >
                                Load Rates →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div className="text-center py-16 text-g500">
          <p className="text-3xl mb-3">📦</p>
          <p>No orders yet.</p>
        </div>
      )}
    </div>
  )
}
