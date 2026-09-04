// Real storefront Orders (checkout/Stripe records) -- distinct from
// Invoices (see lib/portal/orders.ts). Never the same list: a manual
// invoice can exist with no Order behind it, and an Order isn't
// guaranteed to have a linked Invoice yet.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalOrders } from '@/lib/portal/orders'
import { formatMoney, formatMomentDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

export default async function OrdersPage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  // customer.userId is guaranteed set here -- getPortalAuthState() only
  // ever resolves AUTHORIZED via a Customer row found by that same userId.
  const orders = await listPortalOrders(authState.customer.userId!)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const latestPayment = order.payments[0]
              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-heading font-bold text-white text-sm">{order.orderNumber}</p>
                      <p className="text-white/40 text-xs mt-0.5">{formatMomentDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} variant="invoice" />
                      {latestPayment ? <StatusBadge status={latestPayment.status} variant="payment" /> : null}
                      <span className="font-heading font-bold text-gold-light text-sm">{formatMoney(order.total)}</span>
                    </div>
                  </div>
                  {order.invoice ? (
                    <p className="text-white/40 text-xs mt-2">Invoice {order.invoice.invoiceNumber}</p>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
