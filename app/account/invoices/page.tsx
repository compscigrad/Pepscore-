export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalInvoices } from '@/lib/portal/invoices'
import { currentPeriod, getInvoiceHistoryYearRange } from '@/lib/invoice/historyPeriod'
import { formatMoney, formatMomentDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { InvoiceHistoryFilter } from '@/components/invoices/InvoiceHistoryFilter'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; period?: string }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const sp = await searchParams
  const isAll = sp.period === 'all'
  const selected = isAll ? currentPeriod() : { month: Number(sp.month) || currentPeriod().month, year: Number(sp.year) || currentPeriod().year }

  const [invoices, yearRange] = await Promise.all([
    listPortalInvoices(authState.customer.id, isAll ? undefined : selected),
    getInvoiceHistoryYearRange(authState.customer.id),
  ])

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="font-heading text-2xl font-bold text-white">Invoices</h1>
          <InvoiceHistoryFilter
            basePath="/account/invoices"
            month={selected.month}
            year={selected.year}
            isAll={isAll}
            minYear={yearRange?.minYear ?? currentPeriod().year}
            maxYear={yearRange?.maxYear ?? currentPeriod().year}
          />
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">{isAll ? 'No invoices yet.' : 'No invoices in this month. Try "All" to see your full history.'}</p>
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
                    <p className="text-white/40 text-xs mt-0.5">{formatMomentDate(inv.createdAt)}</p>
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
