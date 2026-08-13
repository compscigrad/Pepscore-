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
import { formatProductLabel } from '@/lib/invoice/format'
import { getInvoiceLinePriceTier } from '@/lib/pricing/lineOverride'
import { resolveReorderLine, REORDER_UNAVAILABLE_MESSAGE, type ReorderLineRequest } from '@/lib/storefront/reorder'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder'
import { makeKey } from '@/components/invoices/types'
import type { InvoiceItemDraft } from '@/components/invoices/types'

interface PageProps {
  searchParams: Promise<{ customerId?: string; reorderItems?: string }>
}

// Parses the ?reorderItems=<JSON> param the "Previously Purchased" section
// (components/admin/PreviouslyPurchasedSection.tsx) links here with. Never
// trusts the URL's price or availability -- every line is re-resolved fresh
// against the current product here, since time may have passed between that
// page rendering and this click (or the link was hand-edited/replayed).
function parseReorderRequests(raw: string | undefined): ReorderLineRequest[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is { productId: string; sellUnit: string | null; quantity: number } => p && typeof p.productId === 'string')
      .map((p) => ({ productId: p.productId, sellUnit: (p.sellUnit ?? null) as SellUnit | null, quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1 }))
  } catch {
    return []
  }
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const { customerId, reorderItems: reorderItemsParam } = await searchParams
  const reorderRequests = parseReorderRequests(reorderItemsParam)

  const [products, promotions, prefillCustomer, reorderProducts] = await Promise.all([
    // pricingStatus excludes archived products from the picker -- inStock
    // alone previously let an admin hand-select a discontinued/archived
    // product onto a brand-new invoice. Only gates which products can be
    // newly added here; an existing invoice's already-saved line items are
    // untouched regardless of the current status of the product they
    // reference.
    prisma.product.findMany({ where: { inStock: true, pricingStatus: { not: 'INACTIVE' } }, orderBy: { name: 'asc' } }),
    listPromotions(true),
    customerId ? getCustomer(customerId) : Promise.resolve(null),
    // Deliberately unfiltered by inStock -- a backorderable-but-out-of-stock
    // product must still resolve (resolveReorderLine allows it, matching a
    // fresh purchase), unlike the `products` catalog above which only feeds
    // the manual product-picker datalist.
    reorderRequests.length > 0
      ? prisma.product.findMany({ where: { id: { in: [...new Set(reorderRequests.map((r) => r.productId))] } } })
      : Promise.resolve([]),
  ])

  const reorderProductMap = new Map(reorderProducts.map((p) => [p.id, p]))
  const initialItems: InvoiceItemDraft[] = []
  const skippedReorderMessages: string[] = []
  for (const request of reorderRequests) {
    const product = reorderProductMap.get(request.productId) ?? null
    const resolved = resolveReorderLine(request, product, { adminContext: true })
    if (resolved.status !== 'RESOLVED') {
      const label = product ? formatProductLabel(product) : request.productId
      skippedReorderMessages.push(`${label}: ${REORDER_UNAVAILABLE_MESSAGE[resolved.reason]}`)
      continue
    }
    initialItems.push({
      key: makeKey(),
      id: null,
      productId: product!.id,
      name: formatProductLabel(product!),
      description: '',
      quantity: resolved.quantity,
      unitPrice: resolved.unitPrice,
      lineDiscount: 0,
      sellUnit: resolved.sellUnit,
      unitsPerSellUnit: resolved.unitsPerSellUnit,
      priceTier: getInvoiceLinePriceTier(resolved.sellUnit),
      skuSnapshot: product!.sku,
      inventoryQuantityConsumed: resolved.quantity * resolved.unitsPerSellUnit,
    })
  }

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

        <InvoiceBuilder
          mode="create"
          products={products}
          promotions={promotions}
          prefillCustomer={prefillCustomer}
          initialItems={initialItems.length > 0 ? initialItems : undefined}
          skippedReorderMessages={skippedReorderMessages}
        />
      </div>
    </main>
  )
}
