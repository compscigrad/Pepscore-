// Create-invoice page — fetches the product catalog and active promotions
// server-side, hands them to InvoiceBuilder as props. All interactivity
// (form state, live preview) lives client-side in InvoiceBuilder.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { listPromotions } from '@/lib/promotions'
import { getCustomer } from '@/lib/customers'
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder'

interface PageProps {
  searchParams: Promise<{ customerId?: string }>
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const { customerId } = await searchParams
  const [products, promotions, prefillCustomer] = await Promise.all([
    prisma.product.findMany({ where: { inStock: true }, orderBy: { name: 'asc' } }),
    listPromotions(true),
    customerId ? getCustomer(customerId) : Promise.resolve(null),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">
              {prefillCustomer ? `New Invoice — ${prefillCustomer.firstName} ${prefillCustomer.lastName}` : 'New Invoice'}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {prefillCustomer ? 'Prefilled from the customer profile — review before saving.' : 'Manual or storefront-linked sale'}
            </p>
          </div>
          <Link
            href={prefillCustomer ? `/admin/customers/${prefillCustomer.id}` : '/admin/invoices'}
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← {prefillCustomer ? 'Customer Profile' : 'Invoices'}
          </Link>
        </div>

        <InvoiceBuilder mode="create" products={products} promotions={promotions} prefillCustomer={prefillCustomer} />
      </div>
    </main>
  )
}
