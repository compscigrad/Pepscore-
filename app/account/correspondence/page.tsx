export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalCorrespondence } from '@/lib/portal/correspondence'
import { formatDate } from '@/lib/invoice/format'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { getCategoryLabel } from '@/lib/notifications/categoryLabels'

export default async function CorrespondencePage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const entries = await listPortalCorrespondence(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Correspondence</h1>

        {entries.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">No correspondence yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-white text-sm">{e.subject ?? getCategoryLabel(e.category)}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {getCategoryLabel(e.category)}
                      {e.invoiceNumber ? ` — Invoice ${e.invoiceNumber}` : ''}
                    </p>
                  </div>
                  <span className="text-white/40 text-xs shrink-0">{formatDate(e.sentAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
