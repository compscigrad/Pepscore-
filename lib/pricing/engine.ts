// Pure suggested-pricing calculation. No DB access, no side effects.
//
// Multipliers are calibrated against a supplier CASE cost (10-vial case),
// not a per-vial cost -- verified against the authoritative RUO price table
// (Pepscore_RUO_Price_Table.xlsx, "Pricing Rules" sheet, 2026-08-06): every
// one of the 119 rows reproduces exactly as
// round(supplierCaseCost * multiplier, 2), including the sheet's own worked
// example (Retatrutide 60mg: 326 * 1.0736196319018405 = 350.00).
export const STANDARD_CASE_MULTIPLIER = 8.052147239263803
export const SPA_CASE_MULTIPLIER = 5.674846625766871
export const INDIVIDUAL_VIAL_MULTIPLIER = 1.0736196319018405

export interface SuggestedPricing {
  suggestedStandardCasePrice: number
  suggestedSpaCasePrice: number
  suggestedIndividualVialPrice: number
}

// The authoritative price table rounds every suggestion to the nearest
// whole dollar (matching every existing catalog price, which is always a
// whole number) -- not the nearest cent.
function roundToDollar(n: number): number {
  return Math.round(n)
}

export function calculateSuggestedPricing(supplierCaseCost: number): SuggestedPricing {
  if (!Number.isFinite(supplierCaseCost) || supplierCaseCost < 0) {
    throw new Error('supplierCaseCost must be a non-negative finite number')
  }
  return {
    suggestedStandardCasePrice: roundToDollar(supplierCaseCost * STANDARD_CASE_MULTIPLIER),
    suggestedSpaCasePrice: roundToDollar(supplierCaseCost * SPA_CASE_MULTIPLIER),
    suggestedIndividualVialPrice: roundToDollar(supplierCaseCost * INDIVIDUAL_VIAL_MULTIPLIER),
  }
}

// A product's *displayed* price for a given sell unit: active value if an
// admin has set one, otherwise the formula-suggested value. Never silently
// substitutes a formula value when manualPricingOverride is true and the
// active field is explicitly null -- that state means "reviewed, currently
// unpublished," not "unset, fall back to suggestion." Only a genuinely
// never-configured product (manualPricingOverride false, active null) falls
// back to the suggestion.
export interface ProductPricingSnapshot {
  manualPricingOverride: boolean
  suggestedStandardCasePrice: number | null
  activeStandardCasePrice: number | null
  suggestedSpaCasePrice: number | null
  activeSpaCasePrice: number | null
  suggestedIndividualVialPrice: number | null
  activeIndividualVialPrice: number | null
}

export type SellUnitTier = 'STANDARD' | 'SPA' | 'INDIVIDUAL'

export function getEffectivePrice(product: ProductPricingSnapshot, tier: SellUnitTier): number | null {
  const fields: Record<SellUnitTier, { active: number | null; suggested: number | null }> = {
    STANDARD: { active: product.activeStandardCasePrice, suggested: product.suggestedStandardCasePrice },
    SPA: { active: product.activeSpaCasePrice, suggested: product.suggestedSpaCasePrice },
    INDIVIDUAL: { active: product.activeIndividualVialPrice, suggested: product.suggestedIndividualVialPrice },
  }
  const { active, suggested } = fields[tier]
  if (active !== null) return active
  if (product.manualPricingOverride) return null
  return suggested
}
