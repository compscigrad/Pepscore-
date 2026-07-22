// Edit-invoice page — fetches the invoice plus the product catalog and
// active promotions, hands them to the same InvoiceBuilder used for
// creation (mode="edit" prefills the form from the existing invoice).
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getInvoice } from '@/lib/invoices'
import { listPromotions } from '@/lib/promotions'
import { isSmsConfigured } from '@/lib/intake/delivery'
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder'
import { InvoiceHeaderActions } from '@/components/invoices/InvoiceHeaderActions'
import { StatusBadge } from '@/components/invoices/StatusBadge'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: PageProps) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const { id } = await params
  const [invoice, products, promotions] = await Promise.all([
    getInvoice(id),
    prisma.product.findMany({ where: { inStock: true }, orderBy: { name: 'asc' } }),
    listPromotions(true),
  ])

  if (!invoice) notFound()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white">{invoice.invoiceNumber}</h1>
              <p className="text-white/50 text-sm mt-1">{invoice.customerName}</p>
            </div>
            <StatusBadge status={invoice.status} />
            {invoice.archivedAt ? <StatusBadge status="ARCHIVED" /> : null}
          </div>
          <div className="flex items-center gap-6">
            <InvoiceHeaderActions invoiceId={invoice.id} archived={!!invoice.archivedAt} />
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          </div>
        </div>

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
