// Create-invoice page — fetches the product catalog and active promotions
// server-side, hands them to InvoiceBuilder as props. All interactivity
// (form state, live preview) lives client-side in InvoiceBuilder.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { listPromotions } from '@/lib/promotions'
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder'

export default async function NewInvoicePage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const [products, promotions] = await Promise.all([
    prisma.product.findMany({ where: { inStock: true }, orderBy: { name: 'asc' } }),
    listPromotions(true),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">New Invoice</h1>
            <p className="text-white/50 text-sm mt-1">Manual or storefront-linked sale</p>
          </div>
          <Link
            href="/admin/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Invoices
          </Link>
        </div>

        <InvoiceBuilder mode="create" products={products} promotions={promotions} />
      </div>
    </main>
  )
}
