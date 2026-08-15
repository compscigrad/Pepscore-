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
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Payment Settings</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Payments · Pepscore Lab</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/admin/settings/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoice Settings
            </Link>
          </div>
        </div>

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
