// AI-1.2 -- read-side aggregation over ProductEngagementEvent. Plain
// aggregation, not an AI-generated summary (same posture as
// searchInsights.ts). Never fabricates a result: returns an empty array
// with insufficient event history, and view-to-cart rate is only computed
// for products that actually have at least one view (see
// aggregateEngagement's guard below), never a divide-by-zero placeholder.
import { prisma } from '@/lib/prisma'

export interface ProductEngagementSummary {
  productId: string
  productName: string
  views: number
  addsToCart: number
  // views > 0 always holds for every row this function returns (see the
  // filter below), so this is a real ratio, never divide-by-zero.
  viewToCartRate: number
}

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function aggregateEngagement(
  events: { productId: string; productName: string; eventType: 'VIEW' | 'ADD_TO_CART' }[],
  limit = 25
): ProductEngagementSummary[] {
  const byProduct = new Map<string, { productName: string; views: number; addsToCart: number }>()

  for (const e of events) {
    const existing = byProduct.get(e.productId)
    if (existing) {
      if (e.eventType === 'VIEW') existing.views += 1
      else existing.addsToCart += 1
    } else {
      byProduct.set(e.productId, {
        productName: e.productName,
        views: e.eventType === 'VIEW' ? 1 : 0,
        addsToCart: e.eventType === 'ADD_TO_CART' ? 1 : 0,
      })
    }
  }

  return [...byProduct.entries()]
    .map(([productId, v]) => ({ productId, productName: v.productName, views: v.views, addsToCart: v.addsToCart, viewToCartRate: v.views > 0 ? v.addsToCart / v.views : 0 }))
    // Only products with at least one recorded view are meaningful here --
    // an add-to-cart with zero views for the same product in this window
    // is possible (e.g. Buy Again/reorder skips the product page) but
    // isn't a "view-to-cart rate" in any real sense, so it's excluded
    // rather than shown as a fabricated 0-views/N-carts row.
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
}

export async function getProductEngagementSummary(days: number, limit = 25): Promise<ProductEngagementSummary[]> {
  const events = await prisma.productEngagementEvent.findMany({
    where: { createdAt: { gte: windowStart(days) } },
    select: { productId: true, productName: true, eventType: true },
  })
  return aggregateEngagement(events, limit)
}
