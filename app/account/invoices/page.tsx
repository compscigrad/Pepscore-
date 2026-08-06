export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalInvoices } from '@/lib/portal/invoices'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

export default async function InvoicesPage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const invoices = await listPortalInvoices(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Invoices</h1>

        {invoices.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/account/invoices/${inv.id}`}
                className="block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-heading font-bold text-white text-sm">{inv.invoiceNumber}</p>
                    <p className="text-white/40 text-xs mt-0.5">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={inv.status} variant="invoice" />
                    <span className="font-heading font-bold text-gold-light text-sm">
                      {inv.balanceDue > 0 ? `${formatMoney(inv.balanceDue)} due` : formatMoney(inv.total)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
