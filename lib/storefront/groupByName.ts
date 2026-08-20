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

// Customer-facing copy for the admin-controlled merchandising status
// (2026-08-15) -- the ONLY place this enum's display text is defined, so
// Product Master's dropdown (components/admin/ProductMasterTable.tsx, which
// imports this same map) and this storefront label can never drift apart
// in wording. NONE renders no badge.
export const MERCHANDISING_LABEL: Record<Product['merchandisingStatus'], string | null> = {
  NONE: null,
  POPULAR: 'Popular',
  BEST_SELLER: 'Best Seller',
}

export function groupByName(rows: Product[], options: { proEligible?: boolean } = {}): ProductCardProps[] {
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
      proCasePrice: price?.proCasePrice ?? null,
      // Sell-unit-level fulfillment (2026-08-15) -- Standard Case and
      // Single Vial are independent physical-stock pools (e.g. Semaglutide
      // 30mg: vial Ready to Ship, case Produced to Order), so this is no
      // longer a single availability value per variant.
      caseAvailability: getStorefrontAvailability(p, 'CASE'),
      individualVialAvailability: getStorefrontAvailability(p, 'INDIVIDUAL_VIAL'),
      availabilityMessageOverride: p.availabilityMessageOverride,
    }
    const existing = map.get(p.name)
    if (existing) {
      existing.variants.push(variant)
      // A card is featured if any of its grouped variants (strengths) is --
      // featured is set per Product row, but ProductCard shows one card per
      // product name.
      if (p.featured) existing.featured = true
      // merchandisingStatus is written to every row sharing this name in one
      // admin action (SET_MERCHANDISING_STATUS), so rows should already
      // agree -- this OR-across-variants mirrors `featured` above as a
      // defensive fallback if a family is ever mid-transition, rather than
      // requiring every single strength to be checked before one shows.
      if (!existing.badge && MERCHANDISING_LABEL[p.merchandisingStatus]) existing.badge = MERCHANDISING_LABEL[p.merchandisingStatus]
    } else {
      map.set(p.name, {
        name: p.name,
        featured: p.featured,
        category: p.category,
        description: p.description ?? '',
        imageUrl: resolveProductImage(p.name, p.imageUrl),
        badge: MERCHANDISING_LABEL[p.merchandisingStatus],
        variants: [variant],
      })
    }
  }
  // Featured products sort first (Phase 2B item 6), otherwise preserves the
  // caller's original row order (createdAt asc from every current caller).
  return Array.from(map.values()).sort((a, b) => Number(b.featured) - Number(a.featured))
}
