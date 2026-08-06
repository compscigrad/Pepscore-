export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalProfileForm } from '@/components/account/PortalProfileForm'

export default async function ProfilePage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { customer } = authState

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Profile</h1>
        <PortalProfileForm
          firstName={customer.firstName}
          lastName={customer.lastName}
          email={customer.email}
          phone={customer.phone}
          billingAddress={customer.billingAddress}
          shippingAddress={customer.shippingAddress}
          preferredContactMethod={customer.preferredContactMethod}
        />
      </div>
    </main>
  )
}
