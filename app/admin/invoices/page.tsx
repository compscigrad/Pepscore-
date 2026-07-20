// Invoice dashboard — KPI stats + searchable/sortable/filterable table.
// Mirrors the layout conventions of app/admin/page.tsx so the two admin
// screens read as one product.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listInvoices, getInvoiceDashboardStats } from '@/lib/invoices'
import { InvoiceDashboardStats } from '@/components/invoices/InvoiceDashboardStats'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'

export default async function InvoicesDashboard() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const [stats, { invoices, total }] = await Promise.all([
    getInvoiceDashboardStats(),
    listInvoices({ page: 1, limit: 25 }),
  ])

  return (
    <main className="min-h-screen bg-g100 p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-dark">Invoices</h1>
            <p className="text-g500 text-sm mt-1">Manual and storefront invoicing · Pepscore</p>
          </div>
          <Link
            href="/admin"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-g500 hover:text-gold transition-colors"
          >
            ← Admin Dashboard
          </Link>
        </div>

        <InvoiceDashboardStats stats={stats} />
        <InvoiceTable initialInvoices={invoices} initialTotal={total} />
      </div>
    </main>
  )
}
