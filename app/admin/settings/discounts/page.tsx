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
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function DiscountPresetsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const promotions = await listPromotions(false)

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Discount Presets"
          subtitle="Settings · Discounts · Pepscore Lab"
          actions={
            <Link
              href="/admin/settings/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoice Settings
            </Link>
          }
        />

        <DiscountPresetsManager initialPromotions={promotions} />
      </div>
    </main>
  )
}
