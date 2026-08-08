// Settings > FIRST10 — admin config for the storefront first-order offer.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFirstOrderOfferConfig } from '@/lib/promotions/firstOrderOffer'
import { FirstOrderOfferConfigForm } from '@/components/admin/FirstOrderOfferConfigForm'

export default async function FirstOrderOfferSettingsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const config = await getFirstOrderOfferConfig()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">First-Order Offer</h1>
            <p className="text-white/50 text-sm mt-1">Settings · FIRST10 · Pepscore Lab</p>
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

        <FirstOrderOfferConfigForm
          initial={{
            enabled: config.enabled,
            percentage: config.percentage,
            eligibleProductSlugs: config.eligibleProductSlugs,
            expiresAt: config.expiresAt ? config.expiresAt.toISOString() : null,
            stackable: config.stackable,
          }}
        />
      </div>
    </main>
  )
}
