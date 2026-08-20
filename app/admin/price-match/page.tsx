// Admin Price Match Guarantee review queue (2026-08-20 Price Match sprint).
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { PriceMatchQueue } from '@/components/admin/PriceMatchQueue'

export default async function PriceMatchAdminPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <AdminPageHeader
          title="Price Match Requests"
          subtitle="Review, approve, and manage Customer Preferred Pricing · Pepscore Lab"
          actions={
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          }
        />
        <PriceMatchQueue />
      </div>
    </main>
  )
}
