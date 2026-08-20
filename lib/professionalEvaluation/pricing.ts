// Professional Sample & Evaluation Program (2026-08-20) -- pricing logic.
//
// Business rule: Professional Access does NOT by itself entitle an account
// to a free or discounted sample (see docs/Decisions.md). An evaluation
// unit's price is always derived from the customer's own CURRENT
// canonical case price for this product -- never a second, disconnected
// pricing engine. This module deliberately reuses
// lib/pricing/canonicalPricing.ts's resolveCanonicalPricing() for that
// exact reason: whatever STANDARD / STANDARD_VOLUME_DISCOUNT / PROFESSIONAL /
// PRICE_MATCH (preferred price) precedence the engine already enforces for a
// real case purchase is the same precedence an evaluation unit price is
// derived from, just at quantity 1 (so the volume ladder never applies --
// one evaluation unit is never itself a bulk purchase) and then divided by
// the product's real canonical case quantity.
import { resolveCanonicalPricing, PricingLineUnavailableError, ProfessionalPricingUnauthorizedError, type PricingProduct, type PricingSource } from '@/lib/pricing/canonicalPricing'
import { resolveCaseSize } from '@/lib/pricing/sellUnits'
import type { EvaluationPricingSource } from '@prisma/client'

// Owner-configurable per product via Product.evaluationCreditValidityDays;
// this is only the fallback when a product doesn't override it -- never
// hardcoded at every call site.
export const EVALUATION_CREDIT_DEFAULT_VALIDITY_DAYS = 30

export class EvaluationPricingError extends Error {}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function mapPricingSource(source: PricingSource): EvaluationPricingSource {
  switch (source) {
    case 'PROFESSIONAL':
      return 'PROFESSIONAL'
    case 'PRICE_MATCH':
      // A PriceMatchAuthorization is the one real mechanism behind both
      // "Active Customer Preferred Price" and "Active Price Match
      // Authorization" in this codebase -- there is no second, separate
      // preferred-pricing table. Always recorded as PREFERRED_PRICE; the
      // PRICE_MATCH enum value exists for schema completeness/future use,
      // never produced by this resolver today.
      return 'PREFERRED_PRICE'
    case 'STANDARD':
    case 'STANDARD_VOLUME_DISCOUNT':
      return 'STANDARD'
    case 'BULK':
    case 'INDIVIDUAL':
      // Neither is a real "case price" concept -- unreachable in practice
      // since this resolver only ever requests CASE_STANDARD/CASE_PRO, but
      // mapped defensively rather than left to throw a confusing error deep
      // in a switch.
      return 'STANDARD'
  }
}

export interface ResolveEvaluationUnitPriceInput {
  product: PricingProduct
  proEligible: boolean
  // Caller-resolved, same discipline as every other canonical-engine call
  // site (lib/pricing/preferredPricing.ts) -- never trust a client-
  // submitted value.
  preferredPrice?: number | null
}

export interface ResolvedEvaluationUnitPrice {
  pricingSource: EvaluationPricingSource
  applicableCasePrice: number
  canonicalCaseQuantity: number
  evaluationUnitPrice: number
}

// Resolves the exact per-vial evaluation price for a product, from the
// customer's own current canonical case price. Prefers CASE_PRO when the
// customer is Professional-eligible AND the product has a Professional
// price (matching every other storefront/admin surface's own
// professionalMode rule) -- otherwise CASE_STANDARD. Throws
// EvaluationPricingError if neither tier has an active price at all (never
// silently falls back to $0 or a suggested/unapproved price).
export function resolveEvaluationUnitPrice(input: ResolveEvaluationUnitPriceInput): ResolvedEvaluationUnitPrice {
  const { product, proEligible, preferredPrice } = input
  const sellUnit = proEligible && product.activeProCasePrice != null ? 'CASE_PRO' : 'CASE_STANDARD'

  let resolved
  try {
    ;[resolved] = resolveCanonicalPricing([{ product, sellUnit, quantity: 1, preferredPrice }], { proEligible, allowManualOverride: true })
  } catch (err) {
    if (err instanceof PricingLineUnavailableError || err instanceof ProfessionalPricingUnauthorizedError) {
      throw new EvaluationPricingError(err.message)
    }
    throw err
  }

  const canonicalCaseQuantity = resolveCaseSize(product.unitsPerCase)
  if (!Number.isInteger(canonicalCaseQuantity) || canonicalCaseQuantity <= 0) {
    throw new EvaluationPricingError('This product has no valid canonical case quantity configured.')
  }

  const applicableCasePrice = resolved.unitPrice
  const evaluationUnitPrice = round2(applicableCasePrice / canonicalCaseQuantity)

  return {
    pricingSource: mapPricingSource(resolved.pricingSource),
    applicableCasePrice,
    canonicalCaseQuantity,
    evaluationUnitPrice,
  }
}
