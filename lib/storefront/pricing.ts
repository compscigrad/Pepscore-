// Authoritative public-facing pricing for the storefront -- replaces the
// legacy Product.price/bulkPrice5/bulkPrice10 fields, which predate the
// Inventory & Pricing MVP and are no longer the source of truth for any
// product that has been through pricing review.
//
// Only the Standard Case price is ever shown to an unauthenticated/public
// visitor -- Professional pricing requires the caller to pass an
// already-server-resolved proEligible flag (see
// lib/storefront/professionalAccess.ts), and suggested/supplier-cost fields
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
  // Only ever populated when the caller passes proEligible: true -- see
  // lib/storefront/professionalAccess.ts. Never shown to a public/unauthenticated
  // visitor or a signed-in customer without explicit admin-granted
  // eligibility (Phase 2B section 4/16).
  proCasePrice: number | null
  // True only when this specific visitor is Professional-eligible AND this
  // specific product has a Professional price -- the storefront
  // transformation (section 7) reads this single flag to decide whether to
  // render the Professional purchasing experience (Standard struck through,
  // Professional prominent, Individual Vial hidden, Standard Case removed
  // as a selectable option) instead of the normal Standard/Individual UI.
  // Deliberately product-scoped, not customer-scoped -- a Professional
  // customer viewing a product with no Professional price sees the normal
  // Standard experience for that one product (section 3's documented
  // fallback), never a broken or empty Professional view.
  professionalModeActive: boolean
}

type PriceableProduct = Pick<
  Product,
  'pricingStatus' | 'activeStandardCasePrice' | 'unitsPerCase' | 'individualSalesEnabled' | 'activeIndividualVialPrice' | 'activeProCasePrice'
>

export function getStorefrontPrice(product: PriceableProduct, options: { proEligible?: boolean } = {}): StorefrontPrice | null {
  if (product.pricingStatus !== 'ACTIVE') return null
  if (product.activeStandardCasePrice == null) return null
  const proCasePrice = options.proEligible ? (product.activeProCasePrice ?? null) : null
  return {
    standardCasePrice: product.activeStandardCasePrice,
    unitsPerCase: product.unitsPerCase ?? null,
    // Only surfaced when individual sales are explicitly enabled -- a stored
    // activeIndividualVialPrice alone (e.g. Tesamorelin's hidden $80/$45
    // rows) must never become publicly visible or purchasable.
    individualVialPrice: product.individualSalesEnabled ? (product.activeIndividualVialPrice ?? null) : null,
    proCasePrice,
    professionalModeActive: proCasePrice !== null,
  }
}
