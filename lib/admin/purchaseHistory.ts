// Aggregates a customer's real purchase history -- invoiced lines and, when
// the customer has a linked storefront account, ordered lines too -- into
// distinct (product, sell unit) lines for admin-assisted reorder (Phase 3C
// item 3). A pure read: never returns a historical price, never resolves
// availability itself -- callers resolve each line against the CURRENT
// product via lib/storefront/reorder.ts's resolveReorderLine(request,
// product, { adminContext: true }).
import { prisma } from '@/lib/prisma'
import type { InvoiceItemSellUnit } from '@prisma/client'

export interface PurchaseHistoryLine {
  productId: string
  sellUnit: InvoiceItemSellUnit | null
  quantity: number
  name: string
  purchasedAt: Date
}

// Most historical InvoiceItem rows predate the catalog-linked product
// picker and have no productId at all (free-typed line items) -- those are
// real purchases but can't be reordered against a catalog product, so
// they're silently excluded here rather than surfaced as a broken link.
export async function getCustomerPurchaseHistory(customerId: string, userId: string | null): Promise<PurchaseHistoryLine[]> {
  const [invoiceItems, orderItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { invoice: { customerId }, productId: { not: null } },
      select: { productId: true, sellUnit: true, quantity: true, name: true, invoice: { select: { createdAt: true } } },
    }),
    userId
      ? prisma.orderItem.findMany({
          where: { order: { userId } },
          select: { productId: true, sellUnit: true, quantity: true, name: true, order: { select: { createdAt: true } } },
        })
      : Promise.resolve([]),
  ])

  // Keyed by (productId, sellUnit) so a customer who's bought both a
  // Standard Case and an Individual Vial of the same product sees both as
  // separate reorder lines. Keeps only the most recent occurrence per key
  // (across both invoices and orders) as the quantity/name to display.
  const byKey = new Map<string, PurchaseHistoryLine>()
  function record(productId: string | null, sellUnit: InvoiceItemSellUnit | null, quantity: number, name: string, purchasedAt: Date) {
    if (!productId) return
    const key = `${productId}:${sellUnit ?? 'CASE_STANDARD'}`
    const existing = byKey.get(key)
    if (!existing || purchasedAt > existing.purchasedAt) {
      byKey.set(key, { productId, sellUnit, quantity, name, purchasedAt })
    }
  }

  for (const item of invoiceItems) record(item.productId, item.sellUnit, item.quantity, item.name, item.invoice.createdAt)
  for (const item of orderItems) record(item.productId, item.sellUnit, item.quantity, item.name, item.order.createdAt)

  return [...byKey.values()].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
}
