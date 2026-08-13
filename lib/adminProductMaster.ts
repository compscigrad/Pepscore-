// Read-side data assembly for Admin -> Catalog -> Product Master -- the one
// "see every product and every pricing/status field in one place" view
// requested for the 2026-08-12 admin optimization sprint. Deliberately
// built on top of lib/adminInventory.ts's listInventoryOverview() (same
// Product/pricing/inventory models the existing Inventory page already
// reads) rather than a second catalog query, then enriched with the
// lifecycle/merchandising columns that view doesn't need: archive status,
// case/individual-vial enablement, image status, and last price/inventory
// update timestamps.
import { prisma } from '@/lib/prisma'
import { listInventoryOverview, type InventoryOverviewRow } from '@/lib/adminInventory'
import { resolveProductImage, PRODUCT_FALLBACK_IMAGE } from '@/lib/storefront/productImages'
import { getEffectivePrice, calculateBulkTierPrices, type BulkTierPrices } from '@/lib/pricing/engine'

export type PricingSourceStatus = 'NEEDS_REVIEW' | 'MANUAL_OVERRIDE' | 'FORMULA_DERIVED'

export const PRICING_SOURCE_LABEL: Record<PricingSourceStatus, string> = {
  NEEDS_REVIEW: 'Needs Review',
  MANUAL_OVERRIDE: 'Manual Override',
  FORMULA_DERIVED: 'Formula-Derived',
}

export interface ProductMasterRow extends InventoryOverviewRow {
  archived: boolean
  caseEnabled: boolean
  individualPublicEnabled: boolean
  // A stored individual-vial price can exist even while public sales are
  // disabled (explicit requirement) -- distinct from "no individual price
  // exists at all."
  individualStoredInternal: boolean
  spaInvariantViolated: boolean
  imageIsReal: boolean
  missingPrice: boolean
  pricingSourceStatus: PricingSourceStatus
  lastPriceUpdateAt: Date | null
  lastInventoryUpdateAt: Date | null
  // 2026-08-13 (admin master price table addendum) -- the authoritative
  // Single Vial price shown to admin REGARDLESS of whether public Singles
  // sales are enabled, unlike InventoryOverviewRow.effectiveIndividualPrice
  // (which the plain Inventory page deliberately gates on
  // individualSalesEnabled for its own "Stored — disabled" display
  // convention). Null means no valid price has ever been set -- never
  // fabricated.
  singleVialPrice: number | null
  // Public Standard-pricing bulk tiers (5/8/10/15% off Storefront Case),
  // always computed fresh -- never derived from SPA, never independently
  // stored. Null across the board when there's no Storefront Case price to
  // discount from.
  bulkTiers: BulkTierPrices
}

// Pure derivations, exported for unit testing without a database (mirrors
// lib/invoices/deletionEligibility.ts's computeInvoiceDeletionEligibility
// split -- decision logic separate from the DB-fetching caller below).
export function derivePricingSourceStatus(input: { needsPricingReview: boolean; manualPricingOverride: boolean }): PricingSourceStatus {
  if (input.needsPricingReview) return 'NEEDS_REVIEW'
  if (input.manualPricingOverride) return 'MANUAL_OVERRIDE'
  return 'FORMULA_DERIVED'
}

export function deriveSpaInvariantViolated(effectiveSpaPrice: number | null, effectiveStandardPrice: number | null): boolean {
  return effectiveSpaPrice !== null && effectiveStandardPrice !== null && effectiveSpaPrice >= effectiveStandardPrice
}

export function deriveMissingPrice(effectiveStandardPrice: number | null, effectiveIndividualPrice: number | null): boolean {
  return effectiveStandardPrice === null && effectiveIndividualPrice === null
}

export async function listProductMasterRows(): Promise<ProductMasterRow[]> {
  const [rows, lastPriceChanges, lastInventoryEntries] = await Promise.all([
    listInventoryOverview(),
    prisma.productPriceChange.groupBy({ by: ['productId'], _max: { createdAt: true } }),
    prisma.inventoryLedgerEntry.groupBy({ by: ['productId'], _max: { createdAt: true } }),
  ])

  const lastPriceUpdateByProduct = new Map(lastPriceChanges.map((r) => [r.productId, r._max.createdAt]))
  const lastInventoryUpdateByProduct = new Map(lastInventoryEntries.map((r) => [r.productId, r._max.createdAt]))

  return rows.map((row) => {
    const { product } = row

    return {
      ...row,
      archived: product.pricingStatus === 'INACTIVE',
      caseEnabled: product.activeStandardCasePrice !== null,
      individualPublicEnabled: product.individualSalesEnabled,
      individualStoredInternal: product.activeIndividualVialPrice !== null && !product.individualSalesEnabled,
      spaInvariantViolated: deriveSpaInvariantViolated(row.effectiveSpaPrice, row.effectiveStandardPrice),
      imageIsReal: resolveProductImage(product.name, product.imageUrl) !== PRODUCT_FALLBACK_IMAGE,
      missingPrice: deriveMissingPrice(row.effectiveStandardPrice, row.effectiveIndividualPrice),
      pricingSourceStatus: derivePricingSourceStatus({ needsPricingReview: row.needsPricingReview, manualPricingOverride: product.manualPricingOverride }),
      lastPriceUpdateAt: lastPriceUpdateByProduct.get(product.id) ?? product.lastPricingReviewAt,
      lastInventoryUpdateAt: lastInventoryUpdateByProduct.get(product.id) ?? null,
      singleVialPrice: getEffectivePrice(product, 'INDIVIDUAL'),
      bulkTiers: calculateBulkTierPrices(row.effectiveStandardPrice),
    }
  })
}
