export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getPortalAuthState } from '@/lib/portalAuth'
import { getCustomerAccessSummary } from '@/lib/admin/accessHistory'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalProfileForm } from '@/components/account/PortalProfileForm'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'

export default async function ProfilePage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { customer } = authState
  const [clerkUser, accessSummary] = await Promise.all([currentUser(), getCustomerAccessSummary(customer.id)])
  const primaryEmail = clerkUser?.primaryEmailAddress

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-heading text-2xl font-bold text-white">Profile</h1>
        <PortalProfileForm
          firstName={customer.firstName}
          lastName={customer.lastName}
          email={customer.email}
          phone={customer.phone}
          billingAddress={customer.billingAddress}
          shippingAddress={customer.shippingAddress}
          preferredContactMethod={customer.preferredContactMethod}
        />
        <AccountSecuritySection
          signedInEmail={primaryEmail?.emailAddress ?? null}
          emailVerified={primaryEmail?.verification?.status === 'verified'}
          lastSignInAt={accessSummary.lastSignInAt ? accessSummary.lastSignInAt.toISOString() : null}
        />
      </div>
    </main>
  )
}
