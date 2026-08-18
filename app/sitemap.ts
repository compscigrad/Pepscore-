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
import { MERCHANDISING_TAXONOMY } from '@/lib/storefront/merchandisingTaxonomy'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore-aoai.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { slug: true, updatedAt: true, name: true },
  })
  const activeNames = new Set(products.map((p) => p.name))

  // Merchandising-taxonomy category pages (lib/storefront/
  // merchandisingTaxonomy.ts) -- only indexed when at least one member
  // product is currently active, same "no dead/empty page indexed" rule
  // the raw-category version of this file already followed.
  const categoryEntries = MERCHANDISING_TAXONOMY.filter((c) => c.productNames.some((n) => activeNames.has(n))).map((c) => {
    const lastModified = products
      .filter((p) => c.productNames.includes(p.name))
      .reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), new Date(0))
    return { url: `${APP_URL}/categories/${c.slug}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.6 }
  })

  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${APP_URL}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...categoryEntries,
    ...products.map((p) => ({
      url: `${APP_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
