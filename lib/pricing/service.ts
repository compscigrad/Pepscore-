// Thin DB-I/O wrapper around lib/pricing/engine.ts's pure calculations.
// Every write here follows one rule: changing supplierCaseCost only ever
// touches the suggested* columns; active* columns are only ever touched by
// an explicit admin action (setActivePricing / setManualOverride below).
import { Prisma, type PriceChangeSource, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateSuggestedPricing, SPA_TO_STANDARD_RATIO } from './engine'
import { recordPriceChanges } from './history'

// Pricing invariant (2026-08-12 revision pass #4, owner-directed): SPA is a
// discounted case tier and must always be strictly cheaper than Standard
// Case. Thrown -- never silently written -- whenever an admin edit would
// leave the two tiers contradictory (e.g. changing Standard Case down
// without also lowering an already-set SPA). Carries a proposed corrected
// SPA (the Retatrutide-derived ratio applied to the new Standard Case,
// rounded to the nearest $10) so the caller can offer it as a one-click
// fix rather than making the admin guess a new number.
export class SpaPricingInvariantError extends Error {
  constructor(public standardCasePrice: number, public currentSpaCasePrice: number, public proposedSpaCasePrice: number) {
    super(
      `SPA pricing is now higher than or equal to Standard Case pricing ($${currentSpaCasePrice} >= $${standardCasePrice}). Proposed SPA: $${proposedSpaCasePrice}.`
    )
    this.name = 'SpaPricingInvariantError'
  }
}

export async function recalculateSuggestedPricing(productId: string, supplierCaseCost: number): Promise<Product> {
  const suggested = calculateSuggestedPricing(supplierCaseCost)
  return prisma.product.update({
    where: { id: productId },
    data: {
      supplierCaseCost,
      suggestedStandardCasePrice: suggested.suggestedStandardCasePrice,
      suggestedSpaCasePrice: suggested.suggestedSpaCasePrice,
      suggestedIndividualVialPrice: suggested.suggestedIndividualVialPrice,
    },
  })
}

export interface SetActivePricingInput {
  activeStandardCasePrice?: number | null
  activeSpaCasePrice?: number | null
  activeBulkPrice?: number | null
  activeIndividualVialPrice?: number | null
  individualSalesEnabled?: boolean
  manualPricingOverride?: boolean
  pricingOverrideReason?: string | null
  pricingNotes?: string | null
  unitsPerCase?: number | null
  sku?: string | null
  pricingStatus?: 'ACTIVE' | 'INACTIVE'
}

export interface SetActivePricingContext {
  actorId: string
  source: PriceChangeSource
  reason?: string | null
}

// The one path an admin uses to publish/change what customers are actually
// charged. Always stamps lastPricingReviewAt so "products requiring pricing
// review" (products never reviewed, or reviewed long ago) is a queryable
// fact, not something inferred from updatedAt (which also moves on
// unrelated inventory writes). Every write here also diffs the four active*
// tiers against their prior values and records a ProductPriceChange row per
// tier that actually changed (lib/pricing/history.ts) -- this is the only
// function that ever writes active* prices, so auditing here covers every
// caller (the admin pricing page today, invoice-line "Update Product Price"
// in a later Phase 3B slice) with no risk of a call site forgetting to log.
export async function setActivePricing(productId: string, input: SetActivePricingInput, context: SetActivePricingContext): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    const after = await tx.product.update({
      where: { id: productId },
      data: { ...input, lastPricingReviewAt: new Date() },
    })

    // SPA-below-Standard invariant -- checked against the final resulting
    // state (not just the fields this call happened to touch), so it
    // catches both "lowered Standard below an untouched SPA" and "raised
    // SPA above an untouched Standard." Throwing here rolls back the
    // whole transaction -- never a partially-written contradictory pair.
    if (after.activeStandardCasePrice != null && after.activeSpaCasePrice != null && after.activeSpaCasePrice >= after.activeStandardCasePrice) {
      const proposedSpaCasePrice = Math.min(after.activeSpaCasePrice, Math.round((after.activeStandardCasePrice * SPA_TO_STANDARD_RATIO) / 10) * 10)
      throw new SpaPricingInvariantError(after.activeStandardCasePrice, after.activeSpaCasePrice, proposedSpaCasePrice)
    }

    await recordPriceChanges(tx, { before, after, actorId: context.actorId, source: context.source, reason: context.reason })
    return after
  })
}

export interface SeedProductPricingInput {
  supplierCaseCost?: number | null
  unitsPerCase?: number | null
  activeStandardCasePrice?: number | null
  activeSpaCasePrice?: number | null
  activeBulkPrice?: number | null
  activeIndividualVialPrice?: number | null
  individualSalesEnabled: boolean
  manualPricingOverride: boolean
  pricingOverrideReason?: string | null
  pricingNotes?: string | null
  sku?: string | null
}

// Used by the one-off catalog seed scripts (approved-pricing rows only —
// never a bulk reconstruction). Computes and stores suggested* alongside
// whatever active* values are supplied, in one write, with the same
// lastPricingReviewAt stamp as a manual admin edit.
export async function seedProductPricing(productId: string, input: SeedProductPricingInput): Promise<Product> {
  const suggested = input.supplierCaseCost != null ? calculateSuggestedPricing(input.supplierCaseCost) : null
  const data: Prisma.ProductUpdateInput = {
    supplierCaseCost: input.supplierCaseCost,
    unitsPerCase: input.unitsPerCase,
    activeStandardCasePrice: input.activeStandardCasePrice,
    activeSpaCasePrice: input.activeSpaCasePrice,
    activeBulkPrice: input.activeBulkPrice,
    activeIndividualVialPrice: input.activeIndividualVialPrice,
    individualSalesEnabled: input.individualSalesEnabled,
    manualPricingOverride: input.manualPricingOverride,
    pricingOverrideReason: input.pricingOverrideReason,
    pricingNotes: input.pricingNotes,
    sku: input.sku,
    lastPricingReviewAt: new Date(),
  }
  if (suggested) {
    data.suggestedStandardCasePrice = suggested.suggestedStandardCasePrice
    data.suggestedSpaCasePrice = suggested.suggestedSpaCasePrice
    data.suggestedIndividualVialPrice = suggested.suggestedIndividualVialPrice
  }
  return prisma.product.update({ where: { id: productId }, data })
}
