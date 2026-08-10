// Records and retrieves ProductPriceChange rows -- the audit trail for every
// write to Product's active* price columns. Called exclusively from
// setActivePricing() (lib/pricing/service.ts) so every authoritative price
// write is captured with zero risk of a caller forgetting to log it, the
// same discipline InventoryLedgerEntry already established for stock writes.
import type { Prisma, PriceChangeSource, Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const TIER_FIELDS = [
  { field: 'activeStandardCasePrice', sellUnit: 'STANDARD_CASE' },
  { field: 'activeSpaCasePrice', sellUnit: 'SPA_CASE' },
  { field: 'activeBulkPrice', sellUnit: 'BULK' },
  { field: 'activeIndividualVialPrice', sellUnit: 'INDIVIDUAL_VIAL' },
] as const

export interface TierDiff {
  sellUnit: (typeof TIER_FIELDS)[number]['sellUnit']
  previousPrice: number | null
  newPrice: number | null
}

type TierPriceFields = Pick<Product, (typeof TIER_FIELDS)[number]['field']>

// Diffs the four active* tiers between a before/after pair of product-price
// snapshots -- pure, no I/O, so it's directly unit-testable without a
// database. Never one entry for the whole update: one entry per tier that
// actually changed. Shared by the post-commit audit trail below (Decision
// #48) and the pre-commit global-update preview (Phase 3B item 4,
// components/admin/InventoryDetailPanel.tsx) -- both need exactly the same
// "which tiers changed and by how much" answer, just at different points in
// the save flow.
export function computeTierDiffs(before: TierPriceFields, after: TierPriceFields): TierDiff[] {
  return TIER_FIELDS.filter(({ field }) => before[field] !== after[field]).map(({ field, sellUnit }) => ({
    sellUnit,
    previousPrice: before[field],
    newPrice: after[field],
  }))
}

export interface RecordPriceChangesInput {
  before: Product
  after: Product
  actorId: string
  source: PriceChangeSource
  reason?: string | null
}

export interface PriceChangeRow {
  productId: string
  productName: string
  productSize: string
  sellUnit: (typeof TIER_FIELDS)[number]['sellUnit']
  previousPrice: number | null
  newPrice: number | null
  actorId: string
  source: PriceChangeSource
  reason: string | null
}

export function computePriceChangeRows(input: RecordPriceChangesInput): PriceChangeRow[] {
  const { before, after, actorId, source, reason } = input
  return computeTierDiffs(before, after).map((diff) => ({
    ...diff,
    productId: after.id,
    productName: after.name,
    productSize: after.size,
    actorId,
    source,
    reason: reason ?? null,
  }))
}

export async function recordPriceChanges(tx: Prisma.TransactionClient, input: RecordPriceChangesInput): Promise<void> {
  const rows = computePriceChangeRows(input)
  if (rows.length === 0) return
  await tx.productPriceChange.createMany({ data: rows })
}

export async function getProductPriceHistory(productId: string, limit = 50) {
  return prisma.productPriceChange.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
