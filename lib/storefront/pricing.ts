// Authoritative public-facing pricing for the storefront -- replaces the
// legacy Product.price/bulkPrice5/bulkPrice10 fields, which predate the
// Inventory & Pricing MVP and are no longer the source of truth for any
// product that has been through pricing review.
//
// Only the Standard Case price is ever shown to an unauthenticated/public
// visitor -- SPA pricing needs an explicit eligibility mechanism (not built
// yet) before it can be shown to anyone, and suggested/supplier-cost fields
// must never reach a customer-facing surface at all. A product with no
// active standard price (most of the catalog today -- only a handful of
// products have been through pricing review and publish) has no public
// price; the storefront must show a "pricing available on request" state
// for it rather than falling back to a formula-suggested number.
import type { Product } from '@prisma/client'

export interface StorefrontPrice {
  standardCasePrice: number
  unitsPerCase: number | null
  individualVialPrice: number | null
  // Only ever populated when the caller passes spaEligible: true -- see
  // lib/storefront/spaEligibility.ts. Never shown to a public/unauthenticated
  // visitor or a signed-in customer without explicit admin-granted
  // eligibility (Phase 2B section 4/16).
  spaCasePrice: number | null
}

type PriceableProduct = Pick<
  Product,
  'pricingStatus' | 'activeStandardCasePrice' | 'unitsPerCase' | 'individualSalesEnabled' | 'activeIndividualVialPrice' | 'activeSpaCasePrice'
>

export function getStorefrontPrice(product: PriceableProduct, options: { spaEligible?: boolean } = {}): StorefrontPrice | null {
  if (product.pricingStatus !== 'ACTIVE') return null
  if (product.activeStandardCasePrice == null) return null
  return {
    standardCasePrice: product.activeStandardCasePrice,
    unitsPerCase: product.unitsPerCase ?? null,
    // Only surfaced when individual sales are explicitly enabled -- a stored
    // activeIndividualVialPrice alone (e.g. Tesamorelin's hidden $80/$45
    // rows) must never become publicly visible or purchasable.
    individualVialPrice: product.individualSalesEnabled ? (product.activeIndividualVialPrice ?? null) : null,
    spaCasePrice: options.spaEligible ? (product.activeSpaCasePrice ?? null) : null,
  }
}
