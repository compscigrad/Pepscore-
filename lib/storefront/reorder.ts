// Resolves a historical purchase (product + sell unit + quantity) against
// the CURRENT product state for Buy Again/Reorder (Phase 3C item 2) and
// admin-assisted reorder (Phase 3C item 3). Never clones a historical
// price, never auto-substitutes a different product -- this only ever
// answers "given this exact product and tier, what does it cost and can it
// be added right now."
import type { Product } from '@prisma/client'
import { getAvailableSellUnits, type SellUnit } from '@/lib/pricing/sellUnits'
import { getStorefrontAvailability, isPurchasable } from './availability'

export interface ReorderLineRequest {
  productId: string
  sellUnit: SellUnit | null
  quantity: number
}

// 'sell_unit_no_longer_offered' covers both "this tier has no active price
// set at all" and "this tier's price exists but is no longer offered" (e.g.
// an Individual Vial purchase where individualSalesEnabled has since been
// turned off) -- getAvailableSellUnits() doesn't distinguish the two, and a
// customer-facing reorder flow doesn't need to; either way, that specific
// option isn't currently purchasable.
export type ReorderUnavailableReason = 'product_not_found' | 'discontinued' | 'out_of_stock' | 'sell_unit_no_longer_offered'

export type ResolvedReorderLine =
  | {
      status: 'RESOLVED'
      productId: string
      sellUnit: SellUnit
      quantity: number
      unitPrice: number
      unitsPerSellUnit: number
      backordered: boolean
    }
  | {
      status: 'UNAVAILABLE'
      productId: string
      requestedSellUnit: SellUnit | null
      reason: ReorderUnavailableReason
    }

// Shared with both the customer-facing Buy Again/Reorder All UI
// (components/account/ReorderControls.tsx) and the admin-assisted reorder UI
// (components/admin/PreviouslyPurchasedSection.tsx), so an UNAVAILABLE
// reason always reads the same regardless of which surface shows it.
export const REORDER_UNAVAILABLE_MESSAGE: Record<ReorderUnavailableReason, string> = {
  product_not_found: 'No longer available',
  discontinued: 'No longer available',
  out_of_stock: 'Currently out of stock',
  sell_unit_no_longer_offered: 'This option is no longer offered',
}

export interface ResolveReorderLineOptions {
  // Admin-assisted reorder (Phase 3C item 3) may bypass individualSalesEnabled,
  // mirroring the admin invoice builder's existing bypass (Decision #50) --
  // never set true from a customer-facing code path. Buy Again/Reorder All
  // always call this with no options, which stays gated exactly as before.
  adminContext?: boolean
}

// `product` is null when the referenced Product row no longer exists at all
// (a genuinely deleted catalog entry, not just discontinued/out of stock).
export function resolveReorderLine(
  request: ReorderLineRequest,
  product: Product | null,
  options: ResolveReorderLineOptions = {}
): ResolvedReorderLine {
  if (!product) {
    return { status: 'UNAVAILABLE', productId: request.productId, requestedSellUnit: request.sellUnit, reason: 'product_not_found' }
  }
  if (product.pricingStatus !== 'ACTIVE') {
    return { status: 'UNAVAILABLE', productId: request.productId, requestedSellUnit: request.sellUnit, reason: 'discontinued' }
  }

  // Customer-facing by default (options.adminContext undefined/false). A
  // historical Individual Vial purchase resolves to UNAVAILABLE (not
  // silently substituted to Standard Case) if individualSalesEnabled has
  // since been turned off; the sell unit that's no longer offered is a real
  // fact the customer should see, not paper over. Admin-assisted reorder
  // opts into the same bypass the invoice builder already has.
  const sellUnit = request.sellUnit ?? 'CASE_STANDARD'

  // Sell-unit-level fulfillment (2026-08-15) -- Standard Case and Single
  // Vial are independent physical-stock pools, so a reorder must check
  // purchasability against the sell unit actually being reordered, not a
  // single case-level default.
  const availability = getStorefrontAvailability(product, sellUnit === 'INDIVIDUAL_VIAL' ? 'INDIVIDUAL_VIAL' : 'CASE')
  if (!isPurchasable(availability)) {
    return { status: 'UNAVAILABLE', productId: request.productId, requestedSellUnit: request.sellUnit, reason: 'out_of_stock' }
  }

  const sellUnitOptions = getAvailableSellUnits(product, { adminContext: options.adminContext })
  const option = sellUnitOptions.find((o) => o.sellUnit === sellUnit)
  if (!option) {
    return { status: 'UNAVAILABLE', productId: request.productId, requestedSellUnit: request.sellUnit, reason: 'sell_unit_no_longer_offered' }
  }

  return {
    status: 'RESOLVED',
    productId: product.id,
    sellUnit: option.sellUnit,
    quantity: request.quantity,
    unitPrice: option.price,
    unitsPerSellUnit: option.unitsPerSellUnit,
    backordered: availability === 'BACKORDERED',
  }
}
