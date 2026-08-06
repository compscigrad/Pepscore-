// Customer portal dashboard — the landing page after sign-in. Every figure
// on this page comes from getPortalDashboardData(customer.id), scoped to
// the authenticated customer resolved server-side by getPortalAuthState();
// nothing here ever takes an id from the client.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { getPortalDashboardData } from '@/lib/portal/dashboard'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

export default async function AccountPage() {
  const authState = await getPortalAuthState()

  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') {
    return (
      <PortalStatusShell
        heading="No account found"
        body="We don't see a Pepscore account linked to this login yet. Contact us and we'll get you set up."
      />
    )
  }
  if (authState.state === 'DISABLED') {
    return (
      <PortalStatusShell
        heading="Access disabled"
        body="Portal access for this account has been disabled. Contact us if you believe this is a mistake."
      />
    )
  }

  const { customer } = authState
  const data = await getPortalDashboardData(customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto space-y-6">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.2em] mb-1">My Account</p>
          <h1 className="font-heading text-2xl font-bold text-white">Welcome, {customer.firstName}</h1>
        </div>

        {data.requiredActions.length > 0 ? (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4">
            <p className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-amber-300 mb-2">
              Action Needed
            </p>
            <ul className="space-y-1">
              {data.requiredActions.map((action, i) => (
                <li key={i} className="text-white/80 text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-[0.08em] mb-1">Outstanding Balance</p>
            <p className="font-heading text-2xl font-bold text-gold-light">{formatMoney(data.outstandingBalance)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-[0.08em] mb-1">Account Credit Available</p>
            <p className="font-heading text-2xl font-bold text-white">
              {formatMoney(data.accountCredits.reduce((sum, c) => sum + c.remainingAmount, 0))}
            </p>
          </div>
        </div>

        {data.activeTracking.length > 0 ? (
          <Section title="Active Tracking">
            <div className="space-y-2">
              {data.activeTracking.map((t, i) => (
                <div key={i} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {t.carrier} — {t.trackingNumber}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">Invoice {t.invoiceNumber}</p>
                  </div>
                  <StatusBadge status={t.shippingStatus} variant="shipping" />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {data.backorderNotices.length > 0 ? (
          <Section title="Backordered Items">
            <div className="space-y-2">
              {data.backorderNotices.map((b, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{b.productName}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Invoice {b.invoiceNumber}
                    {b.expectedAvailableDate ? ` — expected ${formatDate(b.expectedAvailableDate)}` : ' — expected date to be confirmed'}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {data.pendingRefunds.length > 0 ? (
          <Section title="Pending Refunds">
            <div className="space-y-2">
              {data.pendingRefunds.map((r, i) => (
                <div key={i} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm font-medium">{formatMoney(r.requestedAmount)} requested</p>
                    <p className="text-white/40 text-xs mt-0.5">Invoice {r.invoiceNumber}</p>
                  </div>
                  <StatusBadge status={r.status} variant="refund" />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Recent Invoices">
          {data.recentInvoices.length === 0 ? (
            <p className="text-white/50 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentInvoices.map((inv) => (
                <div key={inv.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
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
                </div>
              ))}
            </div>
          )}
        </Section>

        {data.recentCommunications.length > 0 ? (
          <Section title="Recent Communications">
            <div className="space-y-2">
              {data.recentCommunications.map((c) => (
                <div key={c.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white/80 text-sm">{c.subject ?? c.category}</p>
                  <p className="text-white/40 text-xs">{formatDate(c.sentAt)}</p>
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
