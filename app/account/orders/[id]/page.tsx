// Real storefront Order detail. Only the fields explicitly rendered below
// ever reach JSX -- OrderItem.costOfGoods (internal margin data) and
// ShippingLabel.shippoLabelId are fetched but never displayed, matching the
// same discipline app/account/invoices/[id]/page.tsx already applies.
export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { getPortalOrderDetail } from '@/lib/portal/orders'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { prisma } from '@/lib/prisma'
import { resolveReorderLine } from '@/lib/storefront/reorder'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { BuyAgainButton, ReorderAllButton, type ReorderLineView } from '@/components/account/ReorderControls'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { id } = await params
  const order = await getPortalOrderDetail(authState.customer.userId!, id)
  if (!order) notFound()

  const latestPayment = order.payments[0]

  // Buy Again/Reorder (Phase 3C): resolve every line against the CURRENT
  // product state server-side, never a historical price snapshot. A
  // productId with no matching Product row (deleted from the catalog)
  // resolves through resolveReorderLine's own product_not_found path.
  const productIds = [...new Set(order.items.map((item) => item.productId))]
  const products = productIds.length > 0 ? await prisma.product.findMany({ where: { id: { in: productIds } } }) : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  const reorderLines: ReorderLineView[] = order.items.map((item) => {
    const product = productMap.get(item.productId) ?? null
    const resolved = resolveReorderLine(
      { productId: item.productId, sellUnit: item.sellUnit as SellUnit | null, quantity: item.quantity },
      product
    )
    return {
      key: item.id,
      productId: item.productId,
      slug: product?.slug ?? '',
      name: product?.name ?? item.name,
      size: product?.size ?? item.size,
      imageUrl: product?.imageUrl ?? '',
      resolved,
    }
  })

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/account/orders" className="text-white/40 hover:text-white text-xs">
            ← All Orders
          </Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">{order.orderNumber}</h1>
            <p className="text-white/40 text-xs mt-1">{formatDate(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} variant="invoice" />
            {latestPayment ? <StatusBadge status={latestPayment.status} variant="payment" /> : null}
          </div>
        </div>

        {order.invoice ? (
          <Link
            href={`/account/invoices/${order.invoice.id}`}
            className="block text-xs text-gold-light hover:text-gold font-heading font-bold uppercase tracking-[0.08em]"
          >
            View Invoice {order.invoice.invoiceNumber} →
          </Link>
        ) : null}

        {/* Line items + totals */}
        <div className="bg-white/[0.03] border border-white/10 rounded-[18px] p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Items</h2>
            <ReorderAllButton lines={reorderLines} />
          </div>
          <div className="divide-y divide-white/10">
            {order.items.map((item) => {
              const line = reorderLines.find((l) => l.key === item.id)
              return (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-white">
                      {item.name} <span className="text-white/40">({item.size}) × {item.quantity}</span>
                    </p>
                    {line ? <div className="mt-1"><BuyAgainButton line={line} /></div> : null}
                  </div>
                  <p className="text-white/80 shrink-0">{formatMoney(item.total)}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-1 text-sm">
            <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
            {order.shippingCost > 0 ? (
              <div className="flex justify-between text-white/60"><span>Shipping</span><span>{formatMoney(order.shippingCost)}</span></div>
            ) : null}
            {order.tax > 0 ? (
              <div className="flex justify-between text-white/60"><span>Tax</span><span>{formatMoney(order.tax)}</span></div>
            ) : null}
            {order.invoice?.discounts.map((d) => (
              <div key={d.id} className="flex justify-between text-white/60"><span>{d.label}</span><span>-{formatMoney(d.appliedAmount)}</span></div>
            ))}
            <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-white/10 mt-2">
              <span>Total</span><span>{formatMoney(order.total)}</span>
            </div>
            {latestPayment && latestPayment.refundedAmount > 0 ? (
              <div className="flex justify-between text-white/60"><span>Refunded</span><span>{formatMoney(latestPayment.refundedAmount)}</span></div>
            ) : null}
          </div>
        </div>

        {order.payments.length > 0 ? (
          <Section title="Payment History">
            <div className="space-y-2">
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <span className="text-white/70">
                    {formatDate(p.createdAt)} — {p.methodType === 'ACH' ? 'Bank transfer' : 'Card'}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} variant="payment" />
                    <span className="text-white font-medium">{formatMoney(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {order.shippingLabel ? (
          <Section title="Shipping & Tracking">
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
              <p className="text-white text-sm font-medium">
                {order.shippingLabel.carrier} — {order.shippingLabel.trackingNumber}
              </p>
              <p className="text-white/40 text-xs mt-0.5">{order.shippingLabel.service}</p>
            </div>
          </Section>
        ) : null}

        {order.invoice && order.invoice.backorderConditions.length > 0 ? (
          <Section title="Backordered Items">
            <div className="space-y-2">
              {order.invoice.backorderConditions.map((b) => (
                <div key={b.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{b.productName}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {b.expectedAvailableDate ? `Expected ${formatDate(b.expectedAvailableDate)}` : 'Expected date to be confirmed'}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-3">{title}</h2>
      {children}
    </div>
  )
}
