// Settings > Discount Presets — create/edit/deactivate/reactivate/delete the
// reusable Promotion catalog. Complements DiscountsSection.tsx's inline
// "+ New Preset" (create-only, scoped to building one invoice) with a
// standalone management surface for everything after creation.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listPromotions } from '@/lib/promotions'
import { DiscountPresetsManager } from '@/components/invoices/DiscountPresetsManager'

export default async function DiscountPresetsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const promotions = await listPromotions(false)

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Discount Presets</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Discounts · Pepscore Lab</p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/admin/settings/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoice Settings
            </Link>
          </div>
        </div>

        <DiscountPresetsManager initialPromotions={promotions} />
      </div>
    </main>
  )
}
