// XML sitemap -- every canonical, indexable public URL: homepage,
// categories index + each category detail page, and every product detail
// page. Discontinued products (pricingStatus INACTIVE, e.g. GLOW50) are
// excluded via the same query filter every storefront browsing surface
// already uses -- there's no separate exclusion list to keep in sync.
// Query-driven pages (/search) and account/admin/checkout routes are
// intentionally never listed here (robots.ts blocks them from crawling
// entirely, and /search's own metadata is noindexed).
import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { categoryToSlug } from '@/lib/storefront/categorySlug'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore-compscigrads-projects.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { slug: true, updatedAt: true, category: true },
  })

  const seenCategories = new Map<string, Date>()
  for (const p of products) {
    const existing = seenCategories.get(p.category)
    if (!existing || p.updatedAt > existing) seenCategories.set(p.category, p.updatedAt)
  }

  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...[...seenCategories.entries()].map(([category, lastModified]) => ({
      url: `${APP_URL}/categories/${categoryToSlug(category)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${APP_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
