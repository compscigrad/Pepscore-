// Storefront-facing availability, derived from the real Inventory MVP state
// rather than the legacy Product.inStock boolean alone. A product that has
// never had inventory tracking enabled (most of the catalog today) falls
// back to inStock -- the same "tracking not started yet" degradation the
// admin inventory UI already uses (ProductInventoryStatus.TRACKING_DISABLED).
// Exact physical counts are never returned here -- only the coarse public
// state a customer should see.
import type { Product } from '@prisma/client'
import { computeAvailableUnits } from '@/lib/inventory/status'

export type StorefrontAvailability = 'AVAILABLE' | 'LIMITED' | 'OUT_OF_STOCK' | 'COMING_SOON'

export function getStorefrontAvailability(
  product: Pick<Product, 'inStock' | 'inventoryTrackingEnabled' | 'inventoryStatus' | 'physicalStockOnHand' | 'reservedUnits'>
): StorefrontAvailability {
  if (!product.inventoryTrackingEnabled) {
    return product.inStock ? 'AVAILABLE' : 'OUT_OF_STOCK'
  }
  switch (product.inventoryStatus) {
    case 'AWAITING_INITIALIZATION':
      return 'COMING_SOON'
    case 'OUT_OF_STOCK':
      return 'OUT_OF_STOCK'
    case 'LOW_STOCK':
      return 'LIMITED'
    case 'IN_STOCK':
      return 'AVAILABLE'
    case 'TRACKING_DISABLED':
    default:
      return product.inStock ? 'AVAILABLE' : 'OUT_OF_STOCK'
  }
}

// True only when a customer should be able to add this exact variant to
// cart right now -- purely a stock question, independent of pricing (a
// caller must check pricing separately; a product can be in stock with no
// approved price yet, or priced but out of stock).
export function isPurchasable(availability: StorefrontAvailability): boolean {
  return availability === 'AVAILABLE' || availability === 'LIMITED'
}

export const AVAILABILITY_LABEL: Record<StorefrontAvailability, string> = {
  AVAILABLE: 'Available',
  LIMITED: 'Limited Availability',
  OUT_OF_STOCK: 'Out of Stock',
  COMING_SOON: 'Coming Soon',
}

// Exported for completeness/tests -- not currently rendered publicly, since
// the spec is explicit that exact internal counts must never be exposed.
export function getAvailableUnits(product: Pick<Product, 'physicalStockOnHand' | 'reservedUnits'>): number | null {
  return computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits)
}
