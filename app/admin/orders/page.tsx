// Online Storefront Orders — customer-initiated web checkouts, distinct
// from Direct & Manual Sales (app/admin/invoices). Phase 4A Critical #2 /
// Phase 4Z sales-origin clarity.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listOrders } from '@/lib/orders/admin'
import { OrderTable } from '@/components/admin/OrderTable'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function OrdersPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const { orders, total } = await listOrders({ page: 1, limit: 25 })

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Online Storefront Orders"
          subtitle="Customer-initiated checkouts · distinct from Direct & Manual Sales · Pepscore Lab"
          actions={
            <>
              <Link href="/admin/invoices" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors">
                Direct &amp; Manual Sales
              </Link>
              <Link href="/admin" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors">
                ← Admin Dashboard
              </Link>
            </>
          }
        />

        <OrderTable initialOrders={orders} initialTotal={total} />
      </div>
    </main>
  )
}
