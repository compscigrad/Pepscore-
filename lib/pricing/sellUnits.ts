// Determines which sell units the invoice builder is allowed to offer for a
// product. This is the one gate individual-vial sales pass through --
// storing activeIndividualVialPrice (e.g. Tesamorelin's approved-but-hidden
// $80) never by itself makes that sell unit selectable; only
// individualSalesEnabled=true does, UNLESS the caller explicitly identifies
// itself as an admin-composition context (see GetAvailableSellUnitsOptions
// below) -- Phase 3B item 2: admin/manual invoicing can compose an
// Individual Vial line for any product with a real stored price even while
// storefront visibility (individualSalesEnabled) stays off. A real price
// must still exist either way -- this never invents a sellable price, only
// bypasses the separate publish/visibility flag. The storefront never calls
// this function at all (its own individualSalesEnabled check lives in
// lib/storefront/pricing.ts, untouched), so adminContext has zero reach into
// anything customer-facing regardless of who calls it with adminContext true.
export type SellUnit = 'CASE_STANDARD' | 'CASE_SPA' | 'CASE_BULK' | 'INDIVIDUAL_VIAL'

// Display label for a bare SellUnit value with no AvailableSellUnitOption at
// hand (e.g. a cart line, which only stores the enum) -- deliberately a
// separate map from lib/pricing/labels.ts's SELL_UNIT_LABEL, which is keyed
// by the differently-named PriceChangeSellUnit enum (STANDARD_CASE vs. this
// file's CASE_STANDARD) for the price-change audit trail. Two pre-existing,
// differently-named enums for the same underlying concept -- not unified
// here to avoid touching Decision #48's audit trail model.
export const SELL_UNIT_DISPLAY_LABEL: Record<SellUnit, string> = {
  CASE_STANDARD: 'Standard Case',
  CASE_SPA: 'SPA Case',
  CASE_BULK: 'Bulk',
  // Customer/admin-facing label (2026-08-13: "Individual Vial" -> "Single
  // Vial") -- the SellUnit enum value itself (INDIVIDUAL_VIAL) is unchanged.
  INDIVIDUAL_VIAL: 'Single Vial',
}

export interface SellUnitAvailabilityInput {
  activeStandardCasePrice: number | null
  activeSpaCasePrice: number | null
  activeBulkPrice: number | null
  activeIndividualVialPrice: number | null
  individualSalesEnabled: boolean
  unitsPerCase: number | null
}

export interface AvailableSellUnitOption {
  sellUnit: SellUnit
  label: string
  price: number
  unitsPerSellUnit: number
  // False only for an admin-context-only Individual Vial option -- lets an
  // admin-facing picker flag "this sell unit isn't visible on the
  // storefront" rather than silently implying every offered option is
  // publicly purchasable.
  visibleToCustomers: boolean
}

export interface GetAvailableSellUnitsOptions {
  // Default false, so every existing (and future) call site is unaffected
  // unless it explicitly opts in. Only ever pass true from an admin-only
  // code path.
  adminContext?: boolean
}

export function getAvailableSellUnits(product: SellUnitAvailabilityInput, options: GetAvailableSellUnitsOptions = {}): AvailableSellUnitOption[] {
  const caseSize = product.unitsPerCase ?? 10
  const result: AvailableSellUnitOption[] = []

  if (product.activeStandardCasePrice !== null) {
    result.push({ sellUnit: 'CASE_STANDARD', label: 'Standard Case', price: product.activeStandardCasePrice, unitsPerSellUnit: caseSize, visibleToCustomers: true })
  }
  if (product.activeSpaCasePrice !== null) {
    result.push({ sellUnit: 'CASE_SPA', label: 'SPA Case', price: product.activeSpaCasePrice, unitsPerSellUnit: caseSize, visibleToCustomers: true })
  }
  if (product.activeBulkPrice !== null) {
    result.push({ sellUnit: 'CASE_BULK', label: 'Bulk', price: product.activeBulkPrice, unitsPerSellUnit: caseSize, visibleToCustomers: true })
  }
  const individualOffered = options.adminContext ? true : product.individualSalesEnabled
  if (individualOffered && product.activeIndividualVialPrice !== null) {
    result.push({
      sellUnit: 'INDIVIDUAL_VIAL',
      label: 'Single Vial',
      price: product.activeIndividualVialPrice,
      unitsPerSellUnit: 1,
      visibleToCustomers: product.individualSalesEnabled,
    })
  }

  return result
}
