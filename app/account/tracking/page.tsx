export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalInvoiceTracking } from '@/lib/portal/invoices'
import { formatDate, formatCarrierLabel } from '@/lib/invoice/format'
import { isTrackableCarrier } from '@/lib/tracking/types'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

export default async function TrackingPage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const invoices = await listPortalInvoiceTracking(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Tracking</h1>

        {invoices.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">No shipments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/account/invoices/${invoice.id}`}
                className="block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="font-heading font-bold text-white text-sm">{invoice.invoiceNumber}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">{formatDate(invoice.createdAt)}</span>
                    <StatusBadge status={invoice.orderStatus} variant="invoice" />
                  </div>
                </div>

                {invoice.shipments.length > 0 ? (
                  <div className="space-y-1">
                    {invoice.shipments.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">{s.carrier} — {s.trackingNumber}</span>
                        <StatusBadge status={s.normalizedStatus} variant="shipping" />
                      </div>
                    ))}
                  </div>
                ) : invoice.carrier && !isTrackableCarrier(invoice.carrier) ? (
                  // Self-delivery/pickup invoice with no real Shipment row --
                  // this is a resolved, expected state, not a missing one.
                  // No tracking number is ever expected here.
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">{formatCarrierLabel(invoice.carrier)}</span>
                    <span className="text-blue-300 font-medium">{invoice.deliveryStatus === 'DELIVERED' ? 'Delivered' : 'Preparing for delivery'}</span>
                  </div>
                ) : null}

                {invoice.backorderConditions.length > 0 ? (
                  <p className="text-amber-300 text-xs mt-1.5">
                    {invoice.backorderConditions.length === 1 ? '1 item backordered' : `${invoice.backorderConditions.length} items backordered`}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
