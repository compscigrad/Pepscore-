// AI-1.5 -- merchandising-category demand aggregation over
// ProductEngagementEvent, joined against the customer-facing merchandising
// taxonomy (lib/storefront/merchandisingTaxonomy.ts) by product name, not
// Product.category -- a product can legitimately belong to more than one
// merchandising category (e.g. GHK-Cu appears under both Recovery/Tissue
// Repair and Dermal/Hair), and that's exactly the browsing surface real
// customers use (category pages, CatalogDirectory), so this counts a view
// or add-to-cart toward every category the product belongs to, not just
// one. Never fabricates: a category with no matching events simply doesn't
// appear, matching productEngagementInsights.ts's own posture.
import { prisma } from '@/lib/prisma'
import { MERCHANDISING_TAXONOMY, categoriesForProductName } from '@/lib/storefront/merchandisingTaxonomy'

export interface CategoryPerformance {
  slug: string
  label: string
  views: number
  addsToCart: number
  viewToCartRate: number
}

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function aggregateCategoryPerformance(
  events: { productName: string; eventType: 'VIEW' | 'ADD_TO_CART' }[]
): CategoryPerformance[] {
  const bySlug = new Map<string, { label: string; views: number; addsToCart: number }>()

  for (const e of events) {
    for (const category of categoriesForProductName(e.productName)) {
      const existing = bySlug.get(category.slug)
      if (existing) {
        if (e.eventType === 'VIEW') existing.views += 1
        else existing.addsToCart += 1
      } else {
        bySlug.set(category.slug, {
          label: category.label,
          views: e.eventType === 'VIEW' ? 1 : 0,
          addsToCart: e.eventType === 'ADD_TO_CART' ? 1 : 0,
        })
      }
    }
  }

  return [...bySlug.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, views: v.views, addsToCart: v.addsToCart, viewToCartRate: v.views > 0 ? v.addsToCart / v.views : 0 }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views)
}

// Merchandising categories with zero recorded engagement in the window --
// the direct "what's genuinely invisible to browsing demand" signal,
// distinct from a low-ranked-but-present category.
export function categoriesWithNoEngagement(performance: CategoryPerformance[]): string[] {
  const seen = new Set(performance.map((p) => p.slug))
  return MERCHANDISING_TAXONOMY.filter((c) => !seen.has(c.slug)).map((c) => c.label)
}

export async function getCategoryPerformance(days: number): Promise<CategoryPerformance[]> {
  const events = await prisma.productEngagementEvent.findMany({
    where: { createdAt: { gte: windowStart(days) } },
    select: { productName: true, eventType: true },
  })
  return aggregateCategoryPerformance(events)
}
