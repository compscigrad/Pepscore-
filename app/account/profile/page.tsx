export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { getPortalAuthState } from '@/lib/portalAuth'
import { getCustomerAccessSummary } from '@/lib/admin/accessHistory'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalProfileForm } from '@/components/account/PortalProfileForm'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'
import { PreferredPricingSection } from '@/components/account/PreferredPricingSection'
import { EvaluationCreditsSection } from '@/components/account/EvaluationCreditsSection'
import { CloseAccountSection } from '@/components/account/CloseAccountSection'
import { listCustomerPreferredPricing } from '@/lib/priceMatch/requests'
import { listCustomerSafeEvaluations } from '@/lib/professionalEvaluation/service'

export default async function ProfilePage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { customer } = authState
  const [clerkUser, accessSummary, preferredPricing, evaluations] = await Promise.all([
    currentUser(),
    getCustomerAccessSummary(customer.id),
    listCustomerPreferredPricing(customer.id),
    listCustomerSafeEvaluations(customer.id),
  ])
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
        <PreferredPricingSection rows={preferredPricing} />
        <EvaluationCreditsSection rows={evaluations} />
        <AccountSecuritySection
          signedInEmail={primaryEmail?.emailAddress ?? null}
          emailVerified={primaryEmail?.verification?.status === 'verified'}
          lastSignInAt={accessSummary.lastSignInAt ? accessSummary.lastSignInAt.toISOString() : null}
        />
        <CloseAccountSection />
      </div>
    </main>
  )
}
