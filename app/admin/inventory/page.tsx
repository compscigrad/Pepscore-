// Admin Inventory + Pricing overview. Every product/strength row, its cached
// inventory status, and its effective (active-or-suggested) pricing --
// sourced from lib/adminInventory.ts, which composes lib/inventory/status.ts
// and lib/pricing/engine.ts rather than duplicating either's logic here.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdminClerkUser } from '@/lib/isAdmin'
import { listInventoryOverview } from '@/lib/adminInventory'
import { AdminInventoryTable } from '@/components/admin/AdminInventoryTable'

export default async function AdminInventoryPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/inventory')
  if (!isAdminClerkUser(userId)) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const rows = await listInventoryOverview()
  const awaitingInit = rows.filter((r) => r.product.inventoryStatus === 'AWAITING_INITIALIZATION').length
  const lowStock = rows.filter((r) => r.product.inventoryStatus === 'LOW_STOCK').length
  const outOfStock = rows.filter((r) => r.product.inventoryStatus === 'OUT_OF_STOCK').length
  const needsPricingReview = rows.filter((r) => r.needsPricingReview).length

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Inventory &amp; Pricing</h1>
            <p className="text-white/50 text-sm mt-0.5">{rows.length} product/strength records</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/inventory/reservations" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
              Reservations →
            </Link>
            <Link href="/admin" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Awaiting Initialization</p>
            <p className="text-2xl font-heading font-bold text-amber-400 mt-1">{awaitingInit}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Low Stock</p>
            <p className="text-2xl font-heading font-bold text-orange-400 mt-1">{lowStock}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Out of Stock</p>
            <p className="text-2xl font-heading font-bold text-red-400 mt-1">{outOfStock}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Needs Pricing Review</p>
            <p className="text-2xl font-heading font-bold text-white mt-1">{needsPricingReview}</p>
          </div>
        </div>

        <AdminInventoryTable rows={rows} />
      </div>
    </main>
  )
}
