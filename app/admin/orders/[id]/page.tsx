// Online Storefront Order detail (Phase 4A Critical #2/#4). Real Order/
// OrderItem/Payment/OrderReservation/ShippingLabel data -- distinct from
// Invoice (see lib/orders/admin.ts's header comment on Order vs Invoice).
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/orders'
import { getOrderDetail, deriveFulfillmentState } from '@/lib/orders/admin'
import { OrderCancelButton } from '@/components/admin/OrderCancelButton'
import { OrderMarkDeliveredButton } from '@/components/admin/OrderMarkDeliveredButton'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'

function readableLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const { id } = await params
  const order = await getOrderDetail(id)
  if (!order) notFound()

  const fulfillmentState = deriveFulfillmentState(order.reservations)
  const latestPayment = order.payments[0]
  const hasSucceededPayment = order.payments.some((p) => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')

  let cancelDisabledReason: string | undefined
  if (order.status === 'CANCELLED') cancelDisabledReason = 'This order is already cancelled.'
  else if (hasSucceededPayment) cancelDisabledReason = 'This order has a successful payment. Refund it (via Stripe) before cancelling.'
  else if (fulfillmentState === 'FULFILLED') cancelDisabledReason = 'This order has already been fully fulfilled. Use the refund/return workflow instead.'

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <div>
          <Link href="/admin/orders" className="text-white/40 hover:text-white text-xs">
            ← Online Storefront Orders
          </Link>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">{order.orderNumber}</h1>
            <p className="text-white/50 text-xs mt-1">
              {new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Online Storefront · last updated{' '}
              {new Date(order.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-start gap-3">
            {order.status === 'SHIPPED' ? <OrderMarkDeliveredButton orderId={order.id} /> : null}
            <OrderCancelButton orderId={order.id} disabled={Boolean(cancelDisabledReason)} disabledReason={cancelDisabledReason} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`${card} p-5 space-y-2`}>
            <p className={`${mutedText} text-[11px] uppercase tracking-wide`}>Customer</p>
            <p className="text-white font-medium">{order.customerName}</p>
            <p className="text-white/60 text-sm">{order.customerEmail}</p>
            {order.userId ? (
              <p className={`${mutedText} text-xs`}>Linked account</p>
            ) : (
              <p className="text-amber-300 text-xs">No linked portal account</p>
            )}
          </div>
          <div className={`${card} p-5 space-y-2`}>
            <p className={`${mutedText} text-[11px] uppercase tracking-wide`}>Status</p>
            <p className="text-white font-medium">{readableLabel(order.status)}</p>
            <p className={`${mutedText} text-[11px] uppercase tracking-wide mt-2`}>Fulfillment</p>
            <p className="text-white font-medium">{readableLabel(fulfillmentState)}</p>
          </div>
        </div>

        <div className={`${card} p-6 space-y-3`}>
          <h3 className={sectionHeading}>Items</h3>
          <div className="divide-y divide-white/10">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between text-sm">
                <div>
                  <p className="text-white">
                    {item.name} <span className="text-white/40">({item.size}) × {item.quantity}</span>
                  </p>
                  {item.sellUnit ? <p className={`${mutedText} text-xs`}>{readableLabel(item.sellUnit)}{item.unitsPerSellUnit ? ` — ${item.unitsPerSellUnit}/unit` : ''}</p> : null}
                </div>
                <p className="text-white/80">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-1 text-sm">
            <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.shippingCost > 0 ? <div className="flex justify-between text-white/60"><span>Shipping</span><span>{formatCurrency(order.shippingCost)}</span></div> : null}
            {order.tax > 0 ? <div className="flex justify-between text-white/60"><span>Tax</span><span>{formatCurrency(order.tax)}</span></div> : null}
            <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-white/10 mt-2"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
          </div>
        </div>

        <div className={`${card} p-6 space-y-3`}>
          <h3 className={sectionHeading}>Reservations</h3>
          {order.reservations.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>No inventory reservations on this order.</p>
          ) : (
            <div className="space-y-2">
              {order.reservations.map((r) => (
                <div key={r.id} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-white">{r.product.name} ({r.product.size}) × {r.quantity}</span>
                  <span className={r.status === 'FULFILLED' ? 'text-green-300' : r.status === 'RELEASED' ? 'text-white/40' : 'text-amber-300'}>{readableLabel(r.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {order.payments.length > 0 ? (
          <div className={`${card} p-6 space-y-3`}>
            <h3 className={sectionHeading}>Payments</h3>
            <div className="space-y-2">
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-white/70">
                    {new Date(p.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })} — {readableLabel(p.methodType)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-white/60">{readableLabel(p.status)}</span>
                    <span className="text-white font-medium">{formatCurrency(p.amount)}</span>
                    {p.refundedAmount > 0 ? <span className="text-orange-300 text-xs">Refunded {formatCurrency(p.refundedAmount)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>Payments</h3>
            <p className={`text-sm ${mutedText} mt-2`}>No payment recorded yet — {latestPayment ? '' : 'checkout may have been abandoned before payment.'}</p>
          </div>
        )}

        {order.shippingLabel ? (
          <div className={`${card} p-6 space-y-2`}>
            <h3 className={sectionHeading}>Shipping &amp; Tracking</h3>
            <p className="text-white text-sm font-medium">{order.shippingLabel.carrier} — {order.shippingLabel.trackingNumber}</p>
            <p className={`${mutedText} text-xs`}>{order.shippingLabel.service}</p>
          </div>
        ) : null}

        {order.invoice ? (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>Related Invoice</h3>
            <Link href={`/admin/invoices/${order.invoice.id}`} className="text-gold-light hover:text-gold font-heading font-bold uppercase tracking-[0.08em] text-sm mt-2 inline-block">
              {order.invoice.invoiceNumber} — {readableLabel(order.invoice.status)} →
            </Link>
          </div>
        ) : null}

        {order.notes ? (
          <div className={`${card} p-6`}>
            <h3 className={sectionHeading}>Notes</h3>
            <p className="text-white/70 text-sm mt-2 whitespace-pre-wrap">{order.notes}</p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
