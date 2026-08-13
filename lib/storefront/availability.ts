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
// backorderEnabled flag, set explicitly by an admin (see
// lib/inventory/backorderConfig.ts).
export type StorefrontAvailability = 'AVAILABLE' | 'LIMITED' | 'BACKORDERED' | 'OUT_OF_STOCK' | 'COMING_SOON'

export function getStorefrontAvailability(
  product: Pick<Product, 'inStock' | 'inventoryTrackingEnabled' | 'inventoryStatus' | 'physicalStockOnHand' | 'reservedUnits' | 'backorderEnabled'>
): StorefrontAvailability {
  const zeroStockState: StorefrontAvailability = product.backorderEnabled ? 'BACKORDERED' : 'OUT_OF_STOCK'

  if (!product.inventoryTrackingEnabled) {
    return product.inStock ? 'AVAILABLE' : zeroStockState
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
      return 'AVAILABLE'
    case 'TRACKING_DISABLED':
    default:
      return product.inStock ? 'AVAILABLE' : zeroStockState
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
  AVAILABLE: 'Available',
  LIMITED: 'Limited Availability',
  // Hourglass prefix (owner spec, 2026-08-13): the catalog-level "small
  // hourglass + label" marker. Deliberately just prefixed onto the existing
  // badge text rather than a new icon component -- reuses the same badge
  // treatment every other availability state already has, no new icon
  // package, no redesign of BackorderIndicator's own restrained dot (which
  // stays as the inline marker next to product names/cart lines).
  BACKORDERED: '⌛ Backordered',
  OUT_OF_STOCK: 'Out of Stock',
  COMING_SOON: 'Coming Soon',
}

// Exported for completeness/tests -- not currently rendered publicly, since
// the spec is explicit that exact internal counts must never be exposed.
export function getAvailableUnits(product: Pick<Product, 'physicalStockOnHand' | 'reservedUnits'>): number | null {
  return computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits)
}
