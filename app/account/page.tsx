// Customer portal dashboard. Replaces the old Stripe-checkout-era Order/User
// view — confirmed zero real Order/User rows exist in production, so there
// is no live usage to preserve. Every query here is scoped to the
// authenticated customer's own id, resolved server-side by
// getPortalAuthState() — never a client-supplied id.
//
// This is intentionally minimal (name + invoice list) — the full dashboard
// (balance, tracking, backorders, refunds, correspondence, required actions)
// is the very next PR in this sprint, built on this same auth foundation.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPortalAuthState } from '@/lib/portalAuth'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'

export default async function AccountPage() {
  const authState = await getPortalAuthState()

  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')

  if (authState.state === 'NOT_LINKED') {
    return (
      <StatusShell heading="No account found" body="We don't see a Pepscore account linked to this login yet. Contact us and we'll get you set up." />
    )
  }

  if (authState.state === 'DISABLED') {
    return (
      <StatusShell heading="Access disabled" body="Portal access for this account has been disabled. Contact us if you believe this is a mistake." />
    )
  }

  const { customer } = authState
  const invoices = await prisma.invoice.findMany({
    where: { customerId: customer.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, invoiceNumber: true, status: true, paymentStatus: true, total: true, balanceDue: true, createdAt: true },
  })

  return (
    <main className="min-h-screen bg-dark px-4 py-10">
      <div className="max-w-[720px] mx-auto">
        <div className="mb-8">
          <p className="text-gold text-xs uppercase tracking-[0.2em] mb-1">My Account</p>
          <h1 className="font-heading text-2xl font-bold text-white">
            Welcome, {customer.firstName}
          </h1>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-[18px] p-8 text-center">
            <p className="text-white/60 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Detail links land in the next PR (invoice detail view) — this
                dashboard stub lists real, ownership-scoped data now so the
                claim flow has a genuine landing spot, without linking
                anywhere that doesn't exist yet. */}
            {invoices.map((inv) => (
              <div key={inv.id} className="block bg-white/[0.03] border border-white/10 rounded-xl p-4">
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
      </div>
    </main>
  )
}

function StatusShell({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE</h1>
        <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">My Account</p>
        <h2 className="text-lg font-bold text-white mb-3">{heading}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{body}</p>
      </div>
    </main>
  )
}
