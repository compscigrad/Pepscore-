// Thin DB-I/O wrapper around lib/pricing/engine.ts's pure calculations.
// Every write here follows one rule: changing supplierCaseCost only ever
// touches the suggested* columns; active* columns are only ever touched by
// an explicit admin action (setActivePricing / setManualOverride below).
import { Prisma, type Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateSuggestedPricing } from './engine'

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

// The one path an admin uses to publish/change what customers are actually
// charged. Always stamps lastPricingReviewAt so "products requiring pricing
// review" (products never reviewed, or reviewed long ago) is a queryable
// fact, not something inferred from updatedAt (which also moves on
// unrelated inventory writes).
export async function setActivePricing(productId: string, input: SetActivePricingInput): Promise<Product> {
  return prisma.product.update({
    where: { id: productId },
    data: { ...input, lastPricingReviewAt: new Date() },
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
