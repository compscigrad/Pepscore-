// Storefront-facing availability, derived from the real Inventory MVP state
// rather than the legacy Product.inStock boolean alone. A product that has
// never had inventory tracking enabled (most of the catalog today) falls
// back to inStock -- the same "tracking not started yet" degradation the
// admin inventory UI already uses (ProductInventoryStatus.TRACKING_DISABLED).
// Exact physical counts are never returned here -- only the coarse public
// state a customer should see.
import type { Product } from '@prisma/client'
import { computeAvailableUnits } from '@/lib/inventory/status'

// BACKORDERED is explicitly distinct from BackorderCondition
// (prisma/schema.prisma) -- that model records a specific invoice line's
// fulfillment shortage after a sale; this state answers a catalog-level
// question asked before any sale exists: "physical inventory is at zero,
// but this product/strength is still configured to accept orders anyway."
// Never derived from whether some other customer's invoice happens to have
// an active BackorderCondition -- always from this product's own
// backorderEnabled/individualVialBackorderEnabled flag, set explicitly by
// an admin.
export type StorefrontAvailability = 'AVAILABLE' | 'LIMITED' | 'BACKORDERED' | 'OUT_OF_STOCK' | 'COMING_SOON'

// Which physical-stock flag applies -- 2026-08-15 sell-unit-level
// fulfillment. The same strength can be "Single Vial ready, Standard Case
// produced to order" (or vice versa), so availability is no longer a single
// per-variant value; every caller must say which sell unit it means.
// CASE covers every case-priced sell unit (standard/SPA/bulk all draw from
// the same physical case stock); INDIVIDUAL_VIAL is its own independent
// pool by design (a vial can be broken out and ready even while full cases
// are still being produced).
export type FulfillmentSellUnit = 'CASE' | 'INDIVIDUAL_VIAL'

export function getStorefrontAvailability(
  product: Pick<
    Product,
    'inStock' | 'inventoryTrackingEnabled' | 'inventoryStatus' | 'physicalStockOnHand' | 'reservedUnits' | 'backorderEnabled' | 'individualVialBackorderEnabled'
  >,
  sellUnit: FulfillmentSellUnit = 'CASE'
): StorefrontAvailability {
  const backorderEnabled = sellUnit === 'INDIVIDUAL_VIAL' ? product.individualVialBackorderEnabled : product.backorderEnabled
  const zeroStockState: StorefrontAvailability = backorderEnabled ? 'BACKORDERED' : 'OUT_OF_STOCK'

  if (!product.inventoryTrackingEnabled) {
    // 2026-08-15 fix (fulfillment/availability sprint): this branch used to
    // check backorderEnabled only when inStock was ALSO false, which made
    // Produced to Order silently inert for the untracked-inventory majority
    // of the catalog (inventoryTrackingEnabled is false everywhere today) --
    // an admin flipping the Product Master "Produced to Order" toggle for a
    // normally-inStock product saw the flag change in the database with no
    // visible effect on the storefront. There's no live inventory signal in
    // this branch to weigh against it (unlike the tracked-inventory switch
    // below, where a genuine restock legitimately should win over a
    // forgotten backorderEnabled flag -- see "restock resolves availability
    // correctly" below) -- both inStock and backorderEnabled are equally
    // manual admin flags here, so an explicit Produced to Order decision
    // always takes priority.
    if (backorderEnabled) return 'BACKORDERED'
    return product.inStock ? 'AVAILABLE' : 'OUT_OF_STOCK'
  }
  switch (product.inventoryStatus) {
    case 'AWAITING_INITIALIZATION':
      // Never pretend an uninitialized product is physically available or
      // backorderable -- COMING_SOON regardless of backorderEnabled, since
      // "awaiting initialization" means opening quantities have never been
      // recorded at all (see Product.physicalStockOnHand's own comment).
      return 'COMING_SOON'
    case 'OUT_OF_STOCK':
      return zeroStockState
    case 'LOW_STOCK':
      return 'LIMITED'
    case 'IN_STOCK':
      // Deliberately does NOT check backorderEnabled here -- see "restock
      // resolves availability correctly" below. A genuinely tracked
      // restock always wins over a stale backorderEnabled flag the admin
      // hasn't turned off yet.
      return 'AVAILABLE'
    case 'TRACKING_DISABLED':
    default:
      // Same reasoning as the untracked branch above -- no live
      // inventoryStatus signal to weigh against backorderEnabled here.
      if (backorderEnabled) return 'BACKORDERED'
      return product.inStock ? 'AVAILABLE' : 'OUT_OF_STOCK'
  }
}

// True only when a customer should be able to add this exact variant to
// cart right now -- purely a stock question, independent of pricing (a
// caller must check pricing separately; a product can be in stock with no
// approved price yet, or priced but out of stock). BACKORDERED is
// purchasable by design -- that's the entire point of the backorder
// workflow (order now, ship when restocked) as distinct from OUT_OF_STOCK.
export function isPurchasable(availability: StorefrontAvailability): boolean {
  return availability === 'AVAILABLE' || availability === 'LIMITED' || availability === 'BACKORDERED'
}

export const AVAILABILITY_LABEL: Record<StorefrontAvailability, string> = {
  // "Ready to Ship" (2026-08-15 fulfillment/availability sprint) -- this
  // state previously rendered no badge at all in ProductCard/ProductDetail
  // ("omitted for the default state to keep the common case uncluttered").
  // The fulfillment-experience redesign now shows an explicit state for
  // every purchasable variant instead of silence for the default one.
  AVAILABLE: '● Ready to Ship',
  LIMITED: 'Limited Availability',
  // Hourglass prefix (owner spec, 2026-08-13): the catalog-level "small
  // hourglass + label" marker. Deliberately just prefixed onto the existing
  // badge text rather than a new icon component -- reuses the same badge
  // treatment every other availability state already has, no new icon
  // package, no redesign of BackorderIndicator's own restrained dot (which
  // stays as the inline marker next to product names/cart lines).
  // Customer-facing text updated to "Produced to Order" (2026-08-15
  // fulfillment/availability sprint) -- the internal state name
  // (BACKORDERED), the Product.backorderEnabled field, and every other
  // internal/admin/accounting reference are deliberately untouched; only
  // this customer-facing label changed.
  BACKORDERED: '⌛ Produced to Order',
  OUT_OF_STOCK: 'Out of Stock',
  COMING_SOON: 'Coming Soon',
}

// Exported for completeness/tests -- not currently rendered publicly, since
// the spec is explicit that exact internal counts must never be exposed.
export function getAvailableUnits(product: Pick<Product, 'physicalStockOnHand' | 'reservedUnits'>): number | null {
  return computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits)
}
