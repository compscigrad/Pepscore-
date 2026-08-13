// Pure suggested-pricing calculation. No DB access, no side effects.
//
// Multipliers are calibrated against a supplier CASE cost (10-vial case),
// not a per-vial cost.
//
// STANDARD/SPA replaced 2026-08-12 (pricing revision pass #4) -- the prior
// STANDARD_CASE_MULTIPLIER (8.052147239263803) and SPA_CASE_MULTIPLIER
// (5.674846625766871), verified against the authoritative RUO price table
// (Pepscore_RUO_Price_Table.xlsx, 2026-08-06), were retired by explicit
// owner instruction as producing RUO-market prices that were too high.
// The new model: Standard Case = supplierCaseCost x 4, SPA Case =
// Standard Case x ~0.705 -- the ratio derived directly from Retatrutide's
// own real approved per-strength pricing (10 rows, ratio range
// 0.7046-0.7052), not re-derived from the retired formula (the two only
// coincide because Retatrutide's currently-approved price happens to be
// old-formula-derived too). Both round to the nearest $10 ("commercial
// rounding"), not the nearest dollar.
//
// INDIVIDUAL_VIAL_MULTIPLIER is UNCHANGED -- no replacement formula has
// been specified for it yet; only Standard/SPA were redefined. Revisit
// once the owner gives an explicit individual-vial pricing rule.
export const STANDARD_CASE_MULTIPLIER = 4
export const SPA_TO_STANDARD_RATIO = 0.705
export const INDIVIDUAL_VIAL_MULTIPLIER = 1.0736196319018405

export interface SuggestedPricing {
  suggestedStandardCasePrice: number
  suggestedSpaCasePrice: number
  suggestedIndividualVialPrice: number
}

// "Commercial rounding to the nearest $10" for Standard/SPA -- distinct
// from Individual Vial's nearest-whole-dollar rounding, which follows the
// old, still-unreplaced per-vial formula.
function roundToTen(n: number): number {
  return Math.round(n / 10) * 10
}

function roundToDollar(n: number): number {
  return Math.round(n)
}

export function calculateSuggestedPricing(supplierCaseCost: number): SuggestedPricing {
  if (!Number.isFinite(supplierCaseCost) || supplierCaseCost < 0) {
    throw new Error('supplierCaseCost must be a non-negative finite number')
  }
  const suggestedStandardCasePrice = roundToTen(supplierCaseCost * STANDARD_CASE_MULTIPLIER)
  let suggestedSpaCasePrice = roundToTen(suggestedStandardCasePrice * SPA_TO_STANDARD_RATIO)
  // Pricing invariant: SPA (a discounted case tier) must always be
  // strictly cheaper than Standard Case -- never silently produce a
  // contradictory pair, even at small supplier costs where rounding could
  // otherwise collide the two.
  if (suggestedStandardCasePrice > 0 && suggestedSpaCasePrice >= suggestedStandardCasePrice) {
    suggestedSpaCasePrice = suggestedStandardCasePrice - 10
  }
  return {
    suggestedStandardCasePrice,
    suggestedSpaCasePrice,
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

// Public Standard-pricing bulk tiers (2026-08-13, admin Product Master
// addendum) -- always derived fresh from the current Storefront Case
// price, never SPA (SPA clients are excluded from bulk discounts, and
// stacking the two was explicitly ruled out) and never independently
// stored, so a case-price edit can never leave a stale bulk column behind.
// The four percentages are the same tiers already shown as marketing copy
// on the homepage (docs/PendingOwnerActions.md #16 -- not yet enforced at
// checkout, this is display/admin-visibility only).
export const BULK_TIER_DISCOUNT: Record<'FIVE' | 'EIGHT' | 'TEN' | 'FIFTEEN', number> = {
  FIVE: 0.05,
  EIGHT: 0.08,
  TEN: 0.1,
  FIFTEEN: 0.15,
}

export interface BulkTierPrices {
  five: number | null
  eight: number | null
  ten: number | null
  fifteen: number | null
}

export function calculateBulkTierPrices(storefrontCasePrice: number | null): BulkTierPrices {
  if (storefrontCasePrice === null) return { five: null, eight: null, ten: null, fifteen: null }
  const roundToCent = (n: number) => Math.round(n * 100) / 100
  return {
    five: roundToCent(storefrontCasePrice * (1 - BULK_TIER_DISCOUNT.FIVE)),
    eight: roundToCent(storefrontCasePrice * (1 - BULK_TIER_DISCOUNT.EIGHT)),
    ten: roundToCent(storefrontCasePrice * (1 - BULK_TIER_DISCOUNT.TEN)),
    fifteen: roundToCent(storefrontCasePrice * (1 - BULK_TIER_DISCOUNT.FIFTEEN)),
  }
}

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
