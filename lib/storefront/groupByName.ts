// Groups flat Product rows by name into consolidated cards with a variants
// array -- shared by the homepage catalog and category pages so there's one
// grouping implementation, not two. Every row is kept regardless of pricing
// or stock state: a variant with no approved active price still browses
// (ProductCard shows "pricing available on request" instead of a
// fabricated number, see lib/storefront/pricing.ts), and an out-of-stock/
// limited/coming-soon variant still browses too, with its real
// availability state shown instead of disappearing from the catalog
// (lib/storefront/availability.ts).
import type { Product } from '@prisma/client'
import type { ProductCardProps } from '@/components/storefront/ProductCard'
import { getStorefrontPrice } from './pricing'
import { getStorefrontAvailability } from './availability'
import { resolveProductImage } from './productImages'

export function groupByName(rows: Product[], options: { spaEligible?: boolean } = {}): ProductCardProps[] {
  const map = new Map<string, ProductCardProps>()
  for (const p of rows) {
    const price = getStorefrontPrice(p, options)
    const variant = {
      id: p.id,
      slug: p.slug,
      size: p.size,
      standardCasePrice: price?.standardCasePrice ?? null,
      unitsPerCase: price?.unitsPerCase ?? null,
      individualVialPrice: price?.individualVialPrice ?? null,
      spaCasePrice: price?.spaCasePrice ?? null,
      availability: getStorefrontAvailability(p),
    }
    const existing = map.get(p.name)
    if (existing) {
      existing.variants.push(variant)
    } else {
      map.set(p.name, {
        name: p.name,
        category: p.category,
        description: p.description ?? '',
        imageUrl: resolveProductImage(p.name, p.imageUrl),
        badge: p.badge ?? null,
        variants: [variant],
      })
    }
  }
  return Array.from(map.values())
}
