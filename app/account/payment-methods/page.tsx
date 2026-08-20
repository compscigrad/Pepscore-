// Customer Portal > Payment Methods -- add/remove/set-default a saved
// card or bank account. "Add" reuses the embedded Stripe setup Checkout
// (mode: 'setup') the same way task #170's real checkout reuses mode:
// 'payment' -- one UI pattern, not two. A setup_session_id in the URL
// (Stripe's return_url after the customer finishes adding a method) is
// captured server-side here before the page renders.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listSavedPaymentMethods, capturePaymentMethodFromSession } from '@/lib/payments/savedMethods'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalPaymentMethodsSection } from '@/components/account/PortalPaymentMethodsSection'

interface PageProps {
  searchParams: Promise<{ setup_session_id?: string }>
}

export default async function PaymentMethodsPage({ searchParams }: PageProps) {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { setup_session_id } = await searchParams
  if (setup_session_id) {
    try {
      await capturePaymentMethodFromSession(setup_session_id, authState.customer.id)
    } catch (err) {
      // A stale/invalid session id (e.g. the customer refreshed this page
      // after it already ran once) should never break the page -- the
      // list below is always the source of truth, not this one-time capture.
      console.error('[account/payment-methods] failed to capture setup session:', err)
    }
  }

  const methods = await listSavedPaymentMethods(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-heading text-2xl font-bold text-white">Payment Methods</h1>
        <PortalPaymentMethodsSection
          initialMethods={methods.map((m) => ({
            id: m.id,
            methodType: m.methodType,
            isDefault: m.isDefault,
            cardBrand: m.cardBrand,
            cardLast4: m.cardLast4,
            cardExpMonth: m.cardExpMonth,
            cardExpYear: m.cardExpYear,
            bankName: m.bankName,
            bankAccountLast4: m.bankAccountLast4,
          }))}
        />
      </div>
    </main>
  )
}
