// Online Storefront Orders — customer-initiated web checkouts, distinct
// from Direct & Manual Sales (app/admin/invoices). Phase 4A Critical #2 /
// Phase 4Z sales-origin clarity.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listOrders } from '@/lib/orders/admin'
import { OrderTable } from '@/components/admin/OrderTable'

export default async function OrdersPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const { orders, total } = await listOrders({ page: 1, limit: 25 })

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Online Storefront Orders</h1>
            <p className="text-white/50 text-sm mt-1">Customer-initiated checkouts · distinct from Direct &amp; Manual Sales · Pepscore Lab</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Link href="/admin/invoices" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors">
              Direct &amp; Manual Sales
            </Link>
            <Link href="/admin" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors">
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        <OrderTable initialOrders={orders} initialTotal={total} />
      </div>
    </main>
  )
}
