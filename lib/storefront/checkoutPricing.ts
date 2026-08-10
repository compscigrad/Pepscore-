// Resolves a checkout cart line's authoritative current price and physical
// unit count for its sell-unit tier -- never trusts the client cart's price
// (pre-existing discipline, see app/api/checkout/route.ts's own comment) or
// its unitsPerSellUnit. Phase 3C's foundational sell-unit-aware cart change:
// checkout previously always assumed Standard Case pricing and reserved
// `quantity` physical vials directly (a real, pre-existing bug -- 1 cart
// "quantity" of a 10-vial case only ever reserved 1 vial, never 10; caught
// while adding this resolver, fixed in the same change since it's exactly
// what unitsPerSellUnit now makes visible).
import type { Product } from '@prisma/client'
import { getAvailableSellUnits, type SellUnit } from '@/lib/pricing/sellUnits'

export interface ResolvedCheckoutLine {
  sellUnit: SellUnit
  unitPrice: number
  unitsPerSellUnit: number
}

export class CheckoutLineUnavailableError extends Error {}

// Customer-facing resolution (adminContext always false/omitted) -- Individual
// Vial is only offered here when individualSalesEnabled is genuinely true,
// exactly matching what the storefront actually displayed. A cart line with
// no sellUnit (every pre-3C cart, and any future free-typed edge case)
// falls back to CASE_STANDARD, matching checkout's only-ever-offered tier
// before this change.
export function resolveCheckoutLine(product: Product, requestedSellUnit: SellUnit | null | undefined): ResolvedCheckoutLine {
  const sellUnit = requestedSellUnit ?? 'CASE_STANDARD'
  const options = getAvailableSellUnits(product)
  const option = options.find((o) => o.sellUnit === sellUnit)
  if (!option) {
    throw new CheckoutLineUnavailableError(`${product.name} (${product.size}) is not currently available in the requested option`)
  }
  return { sellUnit: option.sellUnit, unitPrice: option.price, unitsPerSellUnit: option.unitsPerSellUnit }
}

// How many physical vials a cart line actually consumes -- quantity is
// always "how many units of the sell-unit tier", never a raw vial count
// once a line has a real unitsPerSellUnit (every line resolved via
// resolveCheckoutLine above always has one). The `?? 1` fallback exists
// only for defensive null-safety against a stored OrderItem row that
// somehow has no unitsPerSellUnit; it should be unreachable going forward.
export function computeVialsToReserve(quantity: number, unitsPerSellUnit: number | null | undefined): number {
  return quantity * (unitsPerSellUnit ?? 1)
}
