// Read-side data assembly for the admin Inventory + Pricing pages. Mirrors
// lib/adminDashboard.ts's convention: thin query/shape functions, no
// business logic (that lives in lib/inventory/* and lib/pricing/*).
import { prisma } from '@/lib/prisma'
import { computeAvailableUnits, computeCompleteCasesAvailable } from '@/lib/inventory/status'
import { getActiveBackorderedVialsByProduct } from '@/lib/inventory/backorders'
import { getEffectivePrice } from '@/lib/pricing/engine'
import type { Product } from '@prisma/client'

export interface InventoryOverviewRow {
  product: Product
  availableUnits: number | null
  completeCasesAvailable: number | null
  backorderedVials: number
  effectiveStandardPrice: number | null
  effectiveSpaPrice: number | null
  effectiveIndividualPrice: number | null
  needsPricingReview: boolean
}

// A product "needs pricing review" if it has never been reviewed at all,
// or has a manual override flagged but no active price actually published
// yet (the exact "reviewed but not yet published" state getEffectivePrice
// treats as null rather than silently falling back to the formula).
function needsReview(p: Product): boolean {
  if (p.lastPricingReviewAt === null) return true
  if (p.manualPricingOverride && p.activeStandardCasePrice === null && p.activeIndividualVialPrice === null && p.activeSpaCasePrice === null) return true
  return false
}

export async function listInventoryOverview(): Promise<InventoryOverviewRow[]> {
  const products = await prisma.product.findMany({ orderBy: [{ name: 'asc' }, { size: 'asc' }] })
  const backorderedByProduct = await getActiveBackorderedVialsByProduct()

  return products.map((product) => ({
    product,
    availableUnits: computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits),
    completeCasesAvailable: computeCompleteCasesAvailable(product.physicalStockOnHand, product.reservedUnits, product.unitsPerCase),
    backorderedVials: backorderedByProduct.get(product.id) ?? 0,
    effectiveStandardPrice: getEffectivePrice(product, 'STANDARD'),
    effectiveSpaPrice: getEffectivePrice(product, 'SPA'),
    effectiveIndividualPrice: product.individualSalesEnabled ? getEffectivePrice(product, 'INDIVIDUAL') : null,
    needsPricingReview: needsReview(product),
  }))
}

export async function getInventoryDetail(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return null

  const [ledgerEntries, reservations, alerts, backorderedVials, priceChanges] = await Promise.all([
    prisma.inventoryLedgerEntry.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.inventoryReservation.findMany({ where: { productId, status: 'ACTIVE' }, orderBy: { reservedAt: 'desc' } }),
    prisma.lowStockAlert.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    getActiveBackorderedVialsByProduct().then((m) => m.get(productId) ?? 0),
    prisma.productPriceChange.findMany({ where: { productId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return {
    product,
    availableUnits: computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits),
    completeCasesAvailable: computeCompleteCasesAvailable(product.physicalStockOnHand, product.reservedUnits, product.unitsPerCase),
    backorderedVials,
    ledgerEntries,
    reservations,
    alerts,
    priceChanges,
  }
}

export interface DashboardInventoryAlerts {
  openLowStockAlerts: number
  awaitingInitializationCount: number
  outOfStockCount: number
}

export async function getDashboardInventoryAlerts(): Promise<DashboardInventoryAlerts> {
  const [openLowStockAlerts, awaitingInitializationCount, outOfStockCount] = await Promise.all([
    prisma.lowStockAlert.count({ where: { status: 'OPEN' } }),
    prisma.product.count({ where: { inventoryStatus: 'AWAITING_INITIALIZATION' } }),
    prisma.product.count({ where: { inventoryStatus: 'OUT_OF_STOCK' } }),
  ])
  return { openLowStockAlerts, awaitingInitializationCount, outOfStockCount }
}
