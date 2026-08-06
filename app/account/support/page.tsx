export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalInvoices } from '@/lib/portal/invoices'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalSupportForm } from '@/components/account/PortalSupportForm'

export default async function SupportPage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const invoices = await listPortalInvoices(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Support</h1>
        <PortalSupportForm invoices={invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }))} />
      </div>
    </main>
  )
}
