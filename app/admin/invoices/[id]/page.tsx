// Edit-invoice page — fetches the invoice plus the product catalog and
// active promotions, hands them to the same InvoiceBuilder used for
// creation (mode="edit" prefills the form from the existing invoice).
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getInvoice } from '@/lib/invoices'
import { listPromotions } from '@/lib/promotions'
import { isSmsConfigured } from '@/lib/intake/delivery'
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder'
import { InvoiceHeaderActions } from '@/components/invoices/InvoiceHeaderActions'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: PageProps) {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const { id } = await params
  const [invoice, products, promotions] = await Promise.all([
    getInvoice(id),
    // pricingStatus excludes archived products from the "add item" picker --
    // this only gates newly-added line items; existing InvoiceItem rows on
    // this invoice are stored independently and stay exactly as they were.
    prisma.product.findMany({ where: { inStock: true, pricingStatus: { not: 'INACTIVE' } }, orderBy: { name: 'asc' } }),
    listPromotions(true),
  ])

  if (!invoice) notFound()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title={invoice.invoiceNumber}
          subtitle={
            invoice.customerId ? (
              <Link href={`/admin/customers/${invoice.customerId}`} className="hover:text-gold-light hover:underline">
                {invoice.customerName} — View Profile →
              </Link>
            ) : (
              invoice.customerName
            )
          }
          badge={
            <>
              <StatusBadge status={invoice.status} />
              {invoice.archivedAt ? <StatusBadge status="ARCHIVED" /> : null}
            </>
          }
          actions={
            <>
              <InvoiceHeaderActions invoiceId={invoice.id} archived={!!invoice.archivedAt} />
              <Link
                href="/admin/invoices"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                ← Invoices
              </Link>
            </>
          }
        />

        <InvoiceBuilder
          mode="edit"
          initialInvoice={invoice}
          products={products}
          promotions={promotions}
          smsConfigured={isSmsConfigured()}
        />
      </div>
    </main>
  )
}
