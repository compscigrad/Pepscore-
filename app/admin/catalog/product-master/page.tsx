// Admin -> Catalog -> Product Master (2026-08-12 admin optimization
// sprint). The one authoritative "every product, every pricing/status
// field, in one place" view -- sourced from lib/adminProductMaster.ts,
// which is built on the same Product/pricing/inventory models the
// existing Inventory page already reads, not a second catalog database.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { listProductMasterRows } from '@/lib/adminProductMaster'
import { ProductMasterTable } from '@/components/admin/ProductMasterTable'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function ProductMasterPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/catalog/product-master')
  if (!(await isCurrentUserAdmin())) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const rows = await listProductMasterRows()
  const live = rows.filter((r) => !r.archived).length
  const archived = rows.filter((r) => r.archived).length
  const spaViolations = rows.filter((r) => r.spaInvariantViolated).length
  const needsReview = rows.filter((r) => r.needsPricingReview).length

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <AdminPageHeader
          title="Product Master"
          subtitle={`${rows.length} product/strength records — Catalog`}
          actions={
            <>
              <Link href="/admin/inventory" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                Inventory &amp; Physical Stock →
              </Link>
              <Link href="/admin" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                ← Admin Dashboard
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Live</p>
            <p className="text-2xl font-heading font-bold text-green-400 mt-1">{live}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Archived</p>
            <p className="text-2xl font-heading font-bold text-white/60 mt-1">{archived}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">SPA ≥ Standard</p>
            <p className="text-2xl font-heading font-bold text-red-400 mt-1">{spaViolations}</p>
          </div>
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
            <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">Needs Pricing Review</p>
            <p className="text-2xl font-heading font-bold text-amber-400 mt-1">{needsReview}</p>
          </div>
        </div>

        <ProductMasterTable rows={rows} />
      </div>
    </main>
  )
}
