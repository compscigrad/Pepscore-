// Settings > Payments — checkout method toggles, provider status, and
// processing-cost analytics. See PaymentSettingsForm for the UI.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPaymentSettings } from '@/lib/payments/settings'
import { getPaymentCostAnalytics } from '@/lib/payments/analytics'
import { isStorefrontCheckoutEnabled } from '@/lib/storefront/checkoutGate'
import { PaymentSettingsForm } from '@/components/admin/PaymentSettingsForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function PaymentSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [settings, analytics] = await Promise.all([getPaymentSettings(), getPaymentCostAnalytics()])
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? ''
  const providerStatus = {
    stripeConfigured: stripeSecretKey.length > 0,
    stripeTestMode: stripeSecretKey.startsWith('sk_test_'),
    storefrontCheckoutEnabled: isStorefrontCheckoutEnabled(),
  }

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Payment Settings"
          subtitle="Settings · Payments · Pepscore Lab"
          actions={
            <Link
              href="/admin/settings/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoice Settings
            </Link>
          }
        />

        <PaymentSettingsForm
          initialSettings={{
            cardEnabled: settings.cardEnabled,
            achEnabled: settings.achEnabled,
            cashAppEnabled: settings.cashAppEnabled,
            applePayEnabled: settings.applePayEnabled,
            googlePayEnabled: settings.googlePayEnabled,
            paypalEnabled: settings.paypalEnabled,
            venmoEnabled: settings.venmoEnabled,
          }}
          providerStatus={providerStatus}
          analytics={analytics}
        />
      </div>
    </main>
  )
}
