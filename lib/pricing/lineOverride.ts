// Pure "does this invoice-line price edit need a Use Once vs Update Product
// Price prompt" logic (Phase 3B item 3), kept separate from
// InvoiceItemsTable.tsx's React state so the core decision is directly
// unit-testable without a DOM.
import type { Product } from '@prisma/client'
import type { SellUnit } from './sellUnits'

export type PriceTierField = 'activeStandardCasePrice' | 'activeSpaCasePrice' | 'activeBulkPrice' | 'activeIndividualVialPrice'

// The Product column that holds the authoritative price for a given sell
// unit -- the field setActivePricing() would need to write to apply an
// invoice-line price edit back to the catalog. Kept as its own export so
// both the deviation check below and the "Update Product Price" PATCH
// payload builder use exactly the same mapping.
const TIER_FIELD: Record<SellUnit, PriceTierField> = {
  CASE_STANDARD: 'activeStandardCasePrice',
  CASE_SPA: 'activeSpaCasePrice',
  CASE_BULK: 'activeBulkPrice',
  INDIVIDUAL_VIAL: 'activeIndividualVialPrice',
}

export function getPriceTierField(sellUnit: SellUnit): PriceTierField {
  return TIER_FIELD[sellUnit]
}

// STANDARD/SPA/BULK/INDIVIDUAL/MANUAL -- the InvoiceItem.priceTier value
// that corresponds to a genuinely-catalog-matching price for a given sell
// unit (as opposed to 'MANUAL', used only for a Use Once line-only override).
export type InvoiceLinePriceTier = 'STANDARD' | 'SPA' | 'BULK' | 'INDIVIDUAL'

const SELL_UNIT_TO_PRICE_TIER: Record<SellUnit, InvoiceLinePriceTier> = {
  CASE_STANDARD: 'STANDARD',
  CASE_SPA: 'SPA',
  CASE_BULK: 'BULK',
  INDIVIDUAL_VIAL: 'INDIVIDUAL',
}

export function getInvoiceLinePriceTier(sellUnit: SellUnit): InvoiceLinePriceTier {
  return SELL_UNIT_TO_PRICE_TIER[sellUnit]
}

export interface PriceDeviationInput {
  sellUnit: SellUnit | null
  typedUnitPrice: number
  product: Pick<Product, PriceTierField>
}

export interface PriceDeviationResult {
  // True only when the typed price differs from the catalog's authoritative
  // price for this tier AND a real sell-unit tier is selected. With no tier
  // selected (the legacy flat-price datalist path, no Product to attribute
  // an "Update Product Price" choice to) this is always false -- the edit
  // stays a plain line-only change, exactly as it always has been.
  needsPrompt: boolean
  authoritativePrice: number | null
  tierField: PriceTierField | null
}

export function checkPriceDeviation({ sellUnit, typedUnitPrice, product }: PriceDeviationInput): PriceDeviationResult {
  if (!sellUnit) return { needsPrompt: false, authoritativePrice: null, tierField: null }
  const tierField = getPriceTierField(sellUnit)
  const authoritativePrice = product[tierField]
  const needsPrompt = authoritativePrice !== null && authoritativePrice !== typedUnitPrice
  return { needsPrompt, authoritativePrice, tierField }
}
