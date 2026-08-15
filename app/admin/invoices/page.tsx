// Invoice dashboard — KPI stats + searchable/sortable/filterable table.
// Mirrors the layout conventions of app/admin/page.tsx so the two admin
// screens read as one product.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listInvoices, getInvoiceDashboardStats } from '@/lib/invoices'
import { InvoiceDashboardStats } from '@/components/invoices/InvoiceDashboardStats'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'

export default async function InvoicesDashboard() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [stats, { invoices, total }] = await Promise.all([
    getInvoiceDashboardStats(),
    listInvoices({ page: 1, limit: 25 }),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Invoices</h1>
            <p className="text-white/50 text-sm mt-1">Manual and storefront invoicing · Pepscore Lab</p>
          </div>
          {/* 2026-08-13 nav cleanup: Intake Queue / Inventory / Identity Review /
              Portal Rollout / Notifications / Invoice Settings are all reachable
              from AdminNav above on every admin page now -- repeating them here
              was a leftover duplicate nav path, not distinct functionality.
              Trash stays: it's a genuine Invoices-only contextual action with no
              home in the shared nav. */}
          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/admin/invoices/trash"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Trash
            </Link>
          </div>
        </div>

        <InvoiceDashboardStats stats={stats} />
        <InvoiceTable initialInvoices={invoices} initialTotal={total} />
      </div>
    </main>
  )
}
