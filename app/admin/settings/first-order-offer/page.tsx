// Settings > FIRST10 — admin config for the storefront first-order offer.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFirstOrderOfferConfig } from '@/lib/promotions/firstOrderOffer'
import { FirstOrderOfferConfigForm } from '@/components/admin/FirstOrderOfferConfigForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function FirstOrderOfferSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const config = await getFirstOrderOfferConfig()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="First-Order Offer"
          subtitle="Settings · FIRST10 · Pepscore Lab"
          actions={
            <Link
              href="/admin/settings/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoice Settings
            </Link>
          }
        />

        <FirstOrderOfferConfigForm initial={{ enabled: config.enabled }} />
      </div>
    </main>
  )
}
